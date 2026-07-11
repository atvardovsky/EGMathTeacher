module.exports = {
  RTCPeerConnection: class {
    constructor() {
      this.localDescription = null;
      this.remoteDescription = null;
      this.iceGatheringState = 'complete';
      this.connectionState = 'new';
      this.transceivers = [];
      this.eventHandlers = {};
    }
    addTransceiver(kind) {
      const sender = {
        replaceTrack: jest.fn().mockResolvedValue(undefined),
      };
      const transceiver = { sender };
      this.transceivers.push(transceiver);
      return transceiver;
    }
    setRemoteDescription(desc) {
      this.remoteDescription = desc;
      return Promise.resolve();
    }
    setLocalDescription(desc) {
      this.localDescription = desc;
      return Promise.resolve();
    }
    createAnswer() {
      return Promise.resolve({ type: 'answer', sdp: 'mock-answer-sdp' });
    }
    createOffer() {
      return Promise.resolve({ type: 'offer', sdp: 'mock-offer-sdp' });
    }
    addIceCandidate() {
      return Promise.resolve();
    }
    close() {}
    addEventListener(event, handler) {
      this.eventHandlers[event] = handler;
    }
    removeEventListener() {}
  },
  RTCIceCandidate: class {
    constructor(init) {
      Object.assign(this, init);
    }
  },
};
