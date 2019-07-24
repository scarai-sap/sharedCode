(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports, require('rxjs')) :
  typeof define === 'function' && define.amd ? define(['exports', 'rxjs'], factory) :
  (global = global || self, factory(global.CommunicationLibrary = {}, global.rxjs));
}(this, function (exports, rxjs) { 'use strict';

  class Device {
      constructor(id) {
          this.id = id;
          this.contacts = [];
          this.onNewEvent$ = new rxjs.Subject();
          this.onError$ = new rxjs.Subject();
      }
      getId() {
          return this.id;
      }
      getStatus() {
          return this.status;
      }
      getState() {
          return this.state;
      }
      getContacts() {
          return this.contacts;
      }
      getType() {
          return this.type;
      }
      getAddress() {
          return this.address;
      }
      getName() {
          return this.name;
      }
      getUser() {
          return this.user;
      }
  }

  class Contact {
      constructor(id, device, rawContact) {
          this.id = id;
          this.device = device;
          this.rawContact = rawContact;
          this.users = [];
          this.messages = [];
          this.onNewEvent$ = new rxjs.Subject();
          //
      }
      getId() {
          return this.id;
      }
      getFromAddress() {
          return this.fromAddress;
      }
      getState() {
          return this.state;
      }
      getDevice() {
          return this.device;
      }
      getCreatedAt() {
          return this.createdAt;
      }
      getCreatedBy() {
          return this.createdBy;
      }
      getEndedAt() {
          return this.endedAt;
      }
      getEndedBy() {
          return this.endedBy;
      }
      getConnectedAt() {
          return this.connectedAt;
      }
      getQueueName() {
          return this.queueName;
      }
      getUsers() {
          return this.users;
      }
      getMsgs() {
          return this.messages;
      }
  }

  class AWSContact extends Contact {
      accept() {
          this.rawContact.accept({
              success: () => {
                  console.log('Accept contact successfully - server received your cmd');
              },
              failure: () => {
                  console.error('call awscontact.accept failed');
              }
          });
          return this;
      }
      getDirection() {
          return this.rawContact.isInbound()
              ? 1 /* INBOUND */
              : 2 /* OUTBOUND */;
      }
      decline() {
          this.rawContact.getAgentConnection().destroy({
              success: () => {
                  console.log('Disconnected contact via Streams');
              },
              failure: () => {
                  console.log('Failed to disconnect contact via Streams');
              }
          });
      }
      addState(addedState) {
          switch (addedState) {
              case 4 /* HOLD */:
                  this.state =
                      this.state === 5 /* MUTE */
                          ? 6 /* HOLDANDMUTE */
                          : 4 /* HOLD */;
                  break;
              case 5 /* MUTE */:
                  this.state =
                      this.state === 4 /* HOLD */
                          ? 6 /* HOLDANDMUTE */
                          : 5 /* MUTE */;
                  break;
              default:
                  break;
          }
          return this.state;
      }
      removeState(removedState) {
          switch (removedState) {
              case 4 /* HOLD */:
                  this.state =
                      this.state === 6 /* HOLDANDMUTE */
                          ? 5 /* MUTE */
                          : 2 /* CONNECTED */;
                  break;
              case 5 /* MUTE */:
                  this.state =
                      this.state === 6 /* HOLDANDMUTE */
                          ? 4 /* HOLD */
                          : 2 /* CONNECTED */;
                  break;
              default:
                  break;
          }
          return this.state;
      }
      mute() {
          this.device.mute();
          this.addState(5 /* MUTE */);
          return this;
      }
      unMute() {
          this.device.unmute();
          this.removeState(5 /* MUTE */);
          return this;
      }
      hold() {
          this.rawContact.getAgentConnection().hold({
              success: () => {
                  this.state = this.addState(4 /* HOLD */);
                  this.device.onNewEvent$.next({
                      eventType: 1 /* CONTACT_CHANGE */,
                      payload: this
                  });
              },
              failure: () => {
                  console.error('failed');
              }
          });
          return this;
      }
      unHold() {
          this.rawContact.getAgentConnection().resume({
              success: () => {
                  this.state = this.removeState(4 /* HOLD */);
                  this.device.onNewEvent$.next({
                      eventType: 1 /* CONTACT_CHANGE */,
                      payload: this
                  });
              },
              failure: () => {
                  console.error('failed');
              }
          });
          return this;
      }
      hangup() {
          this.rawContact.getAgentConnection().destroy({
              success: () => {
                  this.endedBy = 'agent';
                  console.log('hangup is executed');
              },
              failure: () => {
                  console.error('failed');
              }
          });
          return this;
      }
      sendMessage(_message) {
          //
      }
      subscriptContactEvents(contact) {
          contact.onConnected((newcontact) => {
              if (newcontact.getContactId() !== this.id) {
                  return;
              }
              this.connectedAt = new Date();
              this.state = 2 /* CONNECTED */;
              this.device.onNewEvent$.next({
                  eventType: 1 /* CONTACT_CHANGE */,
                  payload: this
              });
          });
          contact.onEnded((newcontact) => {
              if (newcontact.getContactId() !== this.id) {
                  return;
              }
              this.endedAt = new Date();
              this.state = 7 /* ENDED */;
              this.device.onNewEvent$.next({
                  eventType: 1 /* CONTACT_CHANGE */,
                  payload: this
              });
          });
          contact.onMissed((newcontact) => {
              if (newcontact.getContactId() !== this.id) {
                  return;
              }
              this.state = 7 /* ENDED */;
              this.device.onNewEvent$.next({
                  eventType: 1 /* CONTACT_CHANGE */,
                  payload: this
              });
          });
      }
      initializeProperties(awsContact) {
          this.queueName = awsContact.getQueue().name || 'unknown queue';
          if (awsContact.getActiveInitialConnection()) {
              this.fromAddress = awsContact
                  .getActiveInitialConnection()
                  .getEndpoint().phoneNumber;
              this.createdAt = awsContact
                  .getActiveInitialConnection()
                  .getStatus().timestamp;
          }
          this.createdBy =
              awsContact.getActiveInitialConnection().getType() === 'inbound'
                  ? this.fromAddress
                  : 'agent';
      }
      // Also record aws device directly to call aws specified API
      constructor(awsContact, awsdevice, initializeState) {
          super(awsContact.getContactId(), awsdevice, awsContact);
          if (initializeState) {
              this.state = initializeState;
          }
          this.subscriptContactEvents(awsContact);
          this.initializeProperties(awsContact);
      }
  }

  class AWSDevice extends Device {
      constructor(deviceParameters, util) {
          super(deviceParameters.id || 'SAP-AWS-CONNECT');
          this.dependenciesLoaded = false;
          this.dependenciesSubject = new rxjs.Subject();
          util.addGlobalScripts(deviceParameters.globalScripts, this.loaded.bind(this));
          this.ccpURL = deviceParameters && deviceParameters.ccpURL;
          this.setParameters();
      }
      // For AWS, we mute/unmute in agent level, provide public method to let contact call */
      mute() {
          this.agent.mute();
          return this;
      }
      unmute() {
          this.agent.unmute();
          return this;
      }
      getStatus() {
          return this.status;
      }
      register(config) {
          // If not loaded, just wait and load again
          if (!this.dependenciesLoaded ||
              typeof connect === 'undefined' ||
              connect === null) {
              this.dependenciesSubject.subscribe(() => this.register(config));
              return;
          }
          this.ccpURL = (config && config.ccpURL) || this.ccpURL;
          if (!this.ccpURL) {
              console.error('register is called');
              return;
          }
          /***
           * Start to connect to aws ccp
           * TODO: more checkings for URL? Whether we need check whether we have connected?
           */
          this.ccpDiv = config && config.ccpDiv;
          if (!this.ccpDiv && typeof document !== 'undefined') {
              this.ccpDiv = document.createElement('awsConnect');
              document.body.appendChild(this.ccpDiv);
              this.ccpDiv.style.visibility = 'hidden';
          }
          connect.core.initCCP(this.ccpDiv, {
              ccpUrl: this.ccpURL,
              loginPopup: true,
              softphone: {
                  allowFramedSoftphone: true
              }
          });
          connect.agent(this.subscribeAgentEvent.bind(this));
          connect.contact(this.subscribeContactEvent.bind(this));
      }
      mapState(agentState) {
          let state;
          switch (agentState.type) {
              case connect.AgentStateType.ROUTABLE:
                  state = 5 /* ROUTABLE */;
                  break;
              case connect.AgentStateType.NOT_ROUTABLE:
                  state = 4 /* NOTROUTABLE */;
                  break;
              case connect.AgentStateType.OFFLINE:
                  state = 3 /* DISCONNECTED */;
                  break;
              default:
                  state = 4 /* NOTROUTABLE */;
                  break;
          }
          return state;
      }
      onError(agent) {
          console.error('One error raised by aws');
          this.onError$.next({
              message: 'Error raised by aws with payload agent',
              payload: agent
          });
          this.changeStateAndNotify(4 /* NOTROUTABLE */);
      }
      onIncoming(oContact) {
          const newContact = new AWSContact(oContact, this, 1 /* INCOMING */);
          this.contacts.push(newContact);
          this.onNewEvent$.next({
              eventType: 1 /* CONTACT_CHANGE */,
              payload: newContact
          });
      }
      removeContactFromList(inputContact) {
          for (let i = 0; i < this.contacts.length; i++) {
              if (this.contacts[i].getId() === inputContact.getContactId()) {
                  this.contacts.splice(i, 1);
                  return;
              }
          }
      }
      setAvailable(available) {
          const routableState = this.agent.getAgentStates().filter((state) => {
              if (available) {
                  return state.type === connect.AgentStateType.ROUTABLE;
              }
              else {
                  return state.type === connect.AgentStateType.NOT_ROUTABLE;
              }
          })[0];
          this.agent.setState(routableState, {
              success: () => {
                  console.log('Set agent status to Available (routable) via Streams');
              },
              failure: () => {
                  console.log('Failed to set agent status to Available (routable) via Streams');
              }
          });
      }
      changeStateAndNotify(newState) {
          this.state = newState;
          this.onNewEvent$.next({
              eventType: 2 /* DEVICE_CHANGE */,
              payload: this
          });
      }
      // Get the agent state and forward to parents if needed
      handleAgentRefresh(agent) {
          const newStatusString = agent.getStatus() && agent.getStatus().name;
          if (!newStatusString) {
              this.changeStateAndNotify(4 /* NOTROUTABLE */);
              return;
          }
          if (newStatusString !== this.status) {
              this.status = newStatusString;
              const newAWSState = agent.getStatus() || connect.AgentStateType.NOT_ROUTABLE;
              const newDeviceState = this.mapState(newAWSState);
              this.changeStateAndNotify(newDeviceState);
          }
      }
      onMuteChanged(obj) {
          console.log('new state for mute is ' + obj.muted);
      }
      subscribeAgentEvent(agent) {
          this.user = agent.getName() || this.name;
          this.name = this.user + '@AWS-connect';
          this.agent = agent;
          agent.onRefresh(this.handleAgentRefresh.bind(this));
          agent.onError(this.onError.bind(this));
          // below are useless?
          agent.onMuteToggle(this.onMuteChanged.bind(this));
      }
      // only watch when event comes and die
      subscribeContactEvent(contact) {
          if (contact.getActiveInitialConnection()) {
              const status = contact.getStatus();
              if (connect.ContactStateType.INIT === status.type ||
                  connect.ContactStatusType.CONNECTING === status.type ||
                  connect.ContactStateType.INCOMING === status.type) {
                  this.onIncoming(contact);
              }
          }
          else {
              contact.onIncoming(this.onIncoming.bind(this));
          }
          // remove from contacts, the contact will notify listener after update its inner state
          contact.onEnded(this.removeContactFromList.bind(this));
          contact.onMissed(this.removeContactFromList.bind(this));
      }
      unregister() {
          console.error('unregister is called');
          this.setAvailable(false);
      }
      setState(state) {
          if (this.state !== state) {
              switch (state) {
                  case 4 /* NOTROUTABLE */:
                      this.setAvailable(false);
                      break;
                  case 5 /* ROUTABLE */:
                      this.setAvailable(true);
                      break;
                  default:
                      console.error('setStte only could be used for routable property');
                      break;
              }
          }
      }
      setParameters() {
          this.type = 1 /* PHONE */;
          this.state = 3 /* DISCONNECTED */;
          this.user = 'unknown';
      }
      loaded() {
          this.dependenciesLoaded = true;
          this.dependenciesSubject.next();
      }
  }

  class ConfigurationService {
      constructor() {
          this.deviceConfigurations = [
              {
                  id: 'SAP-AWS-CONNECT',
                  key: 'SAP-AWS-CONNECT',
                  name: 'SAP AWS Connect',
                  isActive: true,
                  type: 1 /* PREDEFINED */,
                  deviceLocation: '../providers/aws-connect/aws-device-provider',
                  channels: [1 /* PHONE */],
                  parameters: {
                      ccpURL: 'https://core-grm.awsapps.com/connect/ccp',
                      globalScripts: [
                          {
                              url: 'https://cs-ngx-thirdparty-libs-v1.cfapps.sap.hana.ondemand.com/libs/aws/connect-streams-min.js'
                          }
                      ]
                  }
              },
              {
                  id: 'SENDBIRD',
                  key: 'SENDBIRD',
                  name: 'SendBird',
                  isActive: false,
                  type: 2 /* DYMAMICLOAD */,
                  deviceLocation: '../providers/sendbird/sendbird-device',
                  channels: [2 /* CHAT */],
                  parameters: {}
              }
          ];
          // initial things
      }
      getConfigurations() {
          // TODO: it should be refined after configuration service is ready.
          return this.deviceConfigurations;
      }
  }

  class Util {
      constructor() {
          // initial things
      }
      /**
       * Adding a library to the runtime global scope
       * addGlobalScripts
       * @param scriptsConfig IScripts[]
       * @param callback once it ready.
       */
      addGlobalScripts(scriptsConfig, callback) {
          // TODO： we need to support multiple scripts in the future
          if (scriptsConfig.length > 0 &&
              typeof document !== 'undefined' &&
              scriptsConfig[0].url &&
              scriptsConfig[0].url.trim()) {
              const script = document.createElement('script');
              script.src = scriptsConfig[0].url;
              script.onload = callback;
              document.body.appendChild(script);
          }
          else {
              callback();
          }
      }
  }

  class CommunicationLibrary {
      constructor() {
          this.devices = [];
          this.userState = 1 /* UNKNOWN */;
          this.onError$ = new rxjs.Subject();
          this.onNewEvent$ = new rxjs.Subject();
          this.util = new Util();
          this.configuration = new ConfigurationService();
          const aDeviceConfigurations = this.configuration.getConfigurations();
          for (const deviceCfg of aDeviceConfigurations) {
              if (deviceCfg.isActive) {
                  if (deviceCfg.type === 1 /* PREDEFINED */) {
                      switch (deviceCfg.key) {
                          case 'SAP-AWS-CONNECT':
                              const oProvider = new AWSDevice(deviceCfg.parameters, this.util);
                              this.devices.push(oProvider);
                              break;
                          case 'SENDBIRD':
                              //
                              break;
                          default:
                              console.error('unknow predefined provider is found');
                      }
                  }
              }
          }
      }
      static getCommlib() {
          if (!this.instance) {
              this.instance = new CommunicationLibrary();
          }
          return this.instance;
      }
      getDevices() {
          return this.devices;
      }
      getDevice(id) {
          for (const oDevice of this.devices) {
              if (id === oDevice.getId()) {
                  return oDevice;
              }
          }
          return null;
      }
      getUserState() {
          return this.userState;
      }
      setUserState(newState) {
          switch (newState) {
              case 2 /* AVAILABLE */:
                  for (const oDevice of this.devices) {
                      if (oDevice.getState() !== 2 /* CONNECTED */) {
                          oDevice.register();
                      }
                  }
                  break;
              case 3 /* UNAVAILABLE */:
                  // Call unregister even the device state is not connected;
                  for (const oDevice of this.devices) {
                      oDevice.unregister();
                  }
                  break;
              case 1 /* UNKNOWN */:
              case 4 /* BUSY */:
                  break;
              default:
                  //
                  break;
          }
      }
  }

  exports.CommunicationLibrary = CommunicationLibrary;

  Object.defineProperty(exports, '__esModule', { value: true });

}));
