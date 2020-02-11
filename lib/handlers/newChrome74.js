"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const sdpTransform = __importStar(require("sdp-transform"));
const Logger_1 = require("../Logger");
const utils = __importStar(require("../utils"));
const ortc = __importStar(require("../ortc"));
const sdpCommonUtils = __importStar(require("./sdp/commonUtils"));
const sdpUnifiedPlanUtils = __importStar(require("./sdp/unifiedPlanUtils"));
const HandlerInterface_1 = require("./HandlerInterface");
const RemoteSdp_1 = require("./sdp/RemoteSdp");
const scalabilityModes_1 = require("../scalabilityModes");
const logger = new Logger_1.Logger('Chrome74');
const SCTP_NUM_STREAMS = { OS: 1024, MIS: 1024 };
class Chrome74 extends HandlerInterface_1.HandlerInterface {
    constructor() {
        super();
        // Map of RTCTransceivers indexed by MID.
        this._mapMidTransceiver = new Map();
        // Local stream for sending.
        this._sendStream = new MediaStream();
        // Whcted ether a DataChannel m=application section has been created.
        this._hasDataChannelMediaSection = false;
        // Sending DataChannel id value counter. Incremented for each new DataChannel.
        this._nextSendSctpStreamId = 0;
        // Got transport local and remote parameters.
        this._transportReady = false;
    }
    /**
     * Creates a factory function.
     */
    static createFactory() {
        return () => new Chrome74();
    }
    get name() {
        return 'Chrome74';
    }
    close() {
        logger.debug('close()');
        // Close RTCPeerConnection.
        if (this._pc) {
            try {
                this._pc.close();
            }
            catch (error) { }
        }
    }
    run({ direction, iceParameters, iceCandidates, dtlsParameters, sctpParameters, iceServers, iceTransportPolicy, additionalSettings, proprietaryConstraints, extendedRtpCapabilities }) {
        this._direction = direction;
        this._remoteSdp = new RemoteSdp_1.RemoteSdp({
            iceParameters,
            iceCandidates,
            dtlsParameters,
            sctpParameters
        });
        this._sendingRtpParametersByKind =
            {
                audio: ortc.getSendingRtpParameters('audio', extendedRtpCapabilities),
                video: ortc.getSendingRtpParameters('video', extendedRtpCapabilities)
            };
        this._sendingRemoteRtpParametersByKind =
            {
                audio: ortc.getSendingRemoteRtpParameters('audio', extendedRtpCapabilities),
                video: ortc.getSendingRemoteRtpParameters('video', extendedRtpCapabilities)
            };
        this._pc = new RTCPeerConnection(Object.assign({ iceServers: iceServers || [], iceTransportPolicy: iceTransportPolicy || 'all', bundlePolicy: 'max-bundle', rtcpMuxPolicy: 'require', sdpSemantics: 'unified-plan' }, additionalSettings), proprietaryConstraints);
        // Handle RTCPeerConnection connection status.
        this._pc.addEventListener('iceconnectionstatechange', () => {
            switch (this._pc.iceConnectionState) {
                case 'checking':
                    this.emit('@connectionstatechange', 'connecting');
                    break;
                case 'connected':
                case 'completed':
                    this.emit('@connectionstatechange', 'connected');
                    break;
                case 'failed':
                    this.emit('@connectionstatechange', 'failed');
                    break;
                case 'disconnected':
                    this.emit('@connectionstatechange', 'disconnected');
                    break;
                case 'closed':
                    this.emit('@connectionstatechange', 'closed');
                    break;
            }
        });
    }
    getNativeRtpCapabilities() {
        return __awaiter(this, void 0, void 0, function* () {
            logger.debug('getNativeRtpCapabilities()');
            const pc = new RTCPeerConnection({
                iceServers: [],
                iceTransportPolicy: 'all',
                bundlePolicy: 'max-bundle',
                rtcpMuxPolicy: 'require',
                sdpSemantics: 'unified-plan'
            });
            try {
                pc.addTransceiver('audio');
                pc.addTransceiver('video');
                const offer = yield pc.createOffer();
                try {
                    pc.close();
                }
                catch (error) { }
                const sdpObject = sdpTransform.parse(offer.sdp);
                const nativeRtpCapabilities = sdpCommonUtils.extractRtpCapabilities({ sdpObject });
                return nativeRtpCapabilities;
            }
            catch (error) {
                try {
                    pc.close();
                }
                catch (error2) { }
                throw error;
            }
        });
    }
    getNativeSctpCapabilities() {
        return __awaiter(this, void 0, void 0, function* () {
            logger.debug('getNativeSctpCapabilities()');
            return {
                numStreams: SCTP_NUM_STREAMS
            };
        });
    }
    updateIceServers(iceServers) {
        return __awaiter(this, void 0, void 0, function* () {
            logger.debug('updateIceServers()');
            const configuration = this._pc.getConfiguration();
            configuration.iceServers = iceServers;
            this._pc.setConfiguration(configuration);
        });
    }
    restartIce(iceParameters) {
        return __awaiter(this, void 0, void 0, function* () {
            logger.debug('restartIce()');
            // Provide the remote SDP handler with new remote ICE parameters.
            this._remoteSdp.updateIceParameters(iceParameters);
            if (!this._transportReady)
                return;
            if (this._direction === 'send') {
                const offer = yield this._pc.createOffer({ iceRestart: true });
                logger.debug('restartIce() | calling pc.setLocalDescription() [offer:%o]', offer);
                yield this._pc.setLocalDescription(offer);
                const answer = { type: 'answer', sdp: this._remoteSdp.getSdp() };
                logger.debug('restartIce() | calling pc.setRemoteDescription() [answer:%o]', answer);
                yield this._pc.setRemoteDescription(answer);
            }
            else {
                const offer = { type: 'offer', sdp: this._remoteSdp.getSdp() };
                logger.debug('restartIce() | calling pc.setRemoteDescription() [offer:%o]', offer);
                yield this._pc.setRemoteDescription(offer);
                const answer = yield this._pc.createAnswer();
                logger.debug('restartIce() | calling pc.setLocalDescription() [answer:%o]', answer);
                yield this._pc.setLocalDescription(answer);
            }
        });
    }
    getTransportStats() {
        return __awaiter(this, void 0, void 0, function* () {
            return this._pc.getStats();
        });
    }
    send({ track, encodings, codecOptions }) {
        return __awaiter(this, void 0, void 0, function* () {
            logger.debug('send() [kind:%s, track.id:%s]', track.kind, track.id);
            this.assertSendDirection();
            if (encodings && encodings.length > 1) {
                encodings.forEach((encoding, idx) => {
                    encoding.rid = `r${idx}`;
                });
            }
            const mediaSectionIdx = this._remoteSdp.getNextMediaSectionIdx();
            const transceiver = this._pc.addTransceiver(track, {
                direction: 'sendonly',
                streams: [this._sendStream],
                sendEncodings: encodings
            });
            let offer = yield this._pc.createOffer();
            let localSdpObject = sdpTransform.parse(offer.sdp);
            let offerMediaObject;
            const sendingRtpParameters = utils.clone(this._sendingRtpParametersByKind[track.kind]);
            if (!this._transportReady)
                yield this._setupTransport({ localDtlsRole: 'server', localSdpObject });
            logger.debug('send() | calling pc.setLocalDescription() [offer:%o]', offer);
            // Special case for VP9 with SVC.
            let hackVp9Svc = false;
            const layers = scalabilityModes_1.parse((encodings || [{}])[0].scalabilityMode);
            if (encodings &&
                encodings.length === 1 &&
                layers.spatialLayers > 1 &&
                sendingRtpParameters.codecs[0].mimeType.toLowerCase() === 'video/vp9') {
                logger.debug('send() | enabling legacy simulcast for VP9 SVC');
                hackVp9Svc = true;
                localSdpObject = sdpTransform.parse(offer.sdp);
                offerMediaObject = localSdpObject.media[mediaSectionIdx.idx];
                sdpUnifiedPlanUtils.addLegacySimulcast({
                    offerMediaObject,
                    numStreams: layers.spatialLayers
                });
                offer = { type: 'offer', sdp: sdpTransform.write(localSdpObject) };
            }
            yield this._pc.setLocalDescription(offer);
            // We can now get the transceiver.mid.
            const localId = transceiver.mid;
            // Set MID.
            sendingRtpParameters.mid = localId;
            localSdpObject = sdpTransform.parse(this._pc.localDescription.sdp);
            offerMediaObject = localSdpObject.media[mediaSectionIdx.idx];
            // Set RTCP CNAME.
            sendingRtpParameters.rtcp.cname =
                sdpCommonUtils.getCname({ offerMediaObject });
            // Set RTP encodings by parsing the SDP offer if no encodings are given.
            if (!encodings) {
                sendingRtpParameters.encodings =
                    sdpUnifiedPlanUtils.getRtpEncodings({ offerMediaObject });
            }
            // Set RTP encodings by parsing the SDP offer and complete them with given
            // one if just a single encoding has been given.
            else if (encodings.length === 1) {
                let newEncodings = sdpUnifiedPlanUtils.getRtpEncodings({ offerMediaObject });
                Object.assign(newEncodings[0], encodings[0]);
                // Hack for VP9 SVC.
                if (hackVp9Svc)
                    newEncodings = [newEncodings[0]];
                sendingRtpParameters.encodings = newEncodings;
            }
            // Otherwise if more than 1 encoding are given use them verbatim.
            else {
                sendingRtpParameters.encodings = encodings;
            }
            // If VP8 or H264 and there is effective simulcast, add scalabilityMode to
            // each encoding.
            if (sendingRtpParameters.encodings.length > 1 &&
                (sendingRtpParameters.codecs[0].mimeType.toLowerCase() === 'video/vp8' ||
                    sendingRtpParameters.codecs[0].mimeType.toLowerCase() === 'video/h264')) {
                for (const encoding of sendingRtpParameters.encodings) {
                    encoding.scalabilityMode = 'S1T3';
                }
            }
            this._remoteSdp.send({
                offerMediaObject,
                reuseMid: mediaSectionIdx.reuseMid,
                offerRtpParameters: sendingRtpParameters,
                answerRtpParameters: this._sendingRemoteRtpParametersByKind[track.kind],
                codecOptions,
                extmapAllowMixed: true
            });
            const answer = { type: 'answer', sdp: this._remoteSdp.getSdp() };
            logger.debug('send() | calling pc.setRemoteDescription() [answer:%o]', answer);
            yield this._pc.setRemoteDescription(answer);
            // Store in the map.
            this._mapMidTransceiver.set(localId, transceiver);
            return {
                localId,
                rtpParameters: sendingRtpParameters,
                rtpSender: transceiver.sender
            };
        });
    }
    stopSending(localId) {
        return __awaiter(this, void 0, void 0, function* () {
            logger.debug('stopSending() [localId:%s]', localId);
            this.assertSendDirection();
            const transceiver = this._mapMidTransceiver.get(localId);
            if (!transceiver)
                throw new Error('associated RTCRtpTransceiver not found');
            transceiver.sender.replaceTrack(null);
            this._pc.removeTrack(transceiver.sender);
            this._remoteSdp.closeMediaSection(transceiver.mid);
            const offer = yield this._pc.createOffer();
            logger.debug('stopSending() | calling pc.setLocalDescription() [offer:%o]', offer);
            yield this._pc.setLocalDescription(offer);
            const answer = { type: 'answer', sdp: this._remoteSdp.getSdp() };
            logger.debug('stopSending() | calling pc.setRemoteDescription() [answer:%o]', answer);
            yield this._pc.setRemoteDescription(answer);
        });
    }
    replaceTrack(localId, track) {
        return __awaiter(this, void 0, void 0, function* () {
            logger.debug('replaceTrack() [localId:%s, track.id:%s]', localId, track.id);
            this.assertSendDirection();
            const transceiver = this._mapMidTransceiver.get(localId);
            if (!transceiver)
                throw new Error('associated RTCRtpTransceiver not found');
            yield transceiver.sender.replaceTrack(track);
        });
    }
    setMaxSpatialLayer(localId, spatialLayer) {
        return __awaiter(this, void 0, void 0, function* () {
            logger.debug('setMaxSpatialLayer() [localId:%s, spatialLayer:%s]', localId, spatialLayer);
            this.assertSendDirection();
            const transceiver = this._mapMidTransceiver.get(localId);
            if (!transceiver)
                throw new Error('associated RTCRtpTransceiver not found');
            const parameters = transceiver.sender.getParameters();
            parameters.encodings.forEach((encoding, idx) => {
                if (idx <= spatialLayer)
                    encoding.active = true;
                else
                    encoding.active = false;
            });
            yield transceiver.sender.setParameters(parameters);
        });
    }
    setRtpEncodingParameters(localId, params) {
        return __awaiter(this, void 0, void 0, function* () {
            logger.debug('setRtpEncodingParameters() [localId:%s, params:%o]', localId, params);
            this.assertSendDirection();
            const transceiver = this._mapMidTransceiver.get(localId);
            if (!transceiver)
                throw new Error('associated RTCRtpTransceiver not found');
            const parameters = transceiver.sender.getParameters();
            parameters.encodings.forEach((encoding, idx) => {
                parameters.encodings[idx] = Object.assign(Object.assign({}, encoding), params);
            });
            yield transceiver.sender.setParameters(parameters);
        });
    }
    getSenderStats(localId) {
        return __awaiter(this, void 0, void 0, function* () {
            this.assertSendDirection();
            const transceiver = this._mapMidTransceiver.get(localId);
            if (!transceiver)
                throw new Error('associated RTCRtpTransceiver not found');
            return transceiver.sender.getStats();
        });
    }
    sendDataChannel({ ordered, maxPacketLifeTime, maxRetransmits, label, protocol, priority }) {
        return __awaiter(this, void 0, void 0, function* () {
            logger.debug('sendDataChannel()');
            this.assertSendDirection();
            const options = {
                negotiated: true,
                id: this._nextSendSctpStreamId,
                ordered,
                maxPacketLifeTime,
                maxRetransmits,
                protocol,
                priority
            };
            logger.debug('DataChannel options:%o', options);
            const dataChannel = this._pc.createDataChannel(label, options);
            // Increase next id.
            this._nextSendSctpStreamId = ++this._nextSendSctpStreamId % SCTP_NUM_STREAMS.MIS;
            // If this is the first DataChannel we need to create the SDP answer with
            // m=application section.
            if (!this._hasDataChannelMediaSection) {
                const offer = yield this._pc.createOffer();
                const localSdpObject = sdpTransform.parse(offer.sdp);
                const offerMediaObject = localSdpObject.media
                    .find((m) => m.type === 'application');
                if (!this._transportReady)
                    yield this._setupTransport({ localDtlsRole: 'server', localSdpObject });
                logger.debug('sendDataChannel() | calling pc.setLocalDescription() [offer:%o]', offer);
                yield this._pc.setLocalDescription(offer);
                this._remoteSdp.sendSctpAssociation({ offerMediaObject });
                const answer = { type: 'answer', sdp: this._remoteSdp.getSdp() };
                logger.debug('sendDataChannel() | calling pc.setRemoteDescription() [answer:%o]', answer);
                yield this._pc.setRemoteDescription(answer);
                this._hasDataChannelMediaSection = true;
            }
            const sctpStreamParameters = {
                streamId: options.id,
                ordered: options.ordered,
                maxPacketLifeTime: options.maxPacketLifeTime,
                maxRetransmits: options.maxRetransmits
            };
            return { dataChannel, sctpStreamParameters };
        });
    }
    receive({ trackId, kind, rtpParameters }) {
        return __awaiter(this, void 0, void 0, function* () {
            logger.debug('receive() [trackId:%s, kind:%s]', trackId, kind);
            this.assertRecvDirection();
            const localId = String(this._mapMidTransceiver.size);
            this._remoteSdp.receive({
                mid: localId,
                kind,
                offerRtpParameters: rtpParameters,
                streamId: rtpParameters.rtcp.cname,
                trackId
            });
            const offer = { type: 'offer', sdp: this._remoteSdp.getSdp() };
            logger.debug('receive() | calling pc.setRemoteDescription() [offer:%o]', offer);
            yield this._pc.setRemoteDescription(offer);
            let answer = yield this._pc.createAnswer();
            const localSdpObject = sdpTransform.parse(answer.sdp);
            const answerMediaObject = localSdpObject.media
                .find((m) => String(m.mid) === localId);
            // May need to modify codec parameters in the answer based on codec
            // parameters in the offer.
            sdpCommonUtils.applyCodecParameters({
                offerRtpParameters: rtpParameters,
                answerMediaObject
            });
            answer = { type: 'answer', sdp: sdpTransform.write(localSdpObject) };
            if (!this._transportReady)
                yield this._setupTransport({ localDtlsRole: 'client', localSdpObject });
            logger.debug('receive() | calling pc.setLocalDescription() [answer:%o]', answer);
            yield this._pc.setLocalDescription(answer);
            const transceiver = this._pc.getTransceivers()
                .find((t) => t.mid === localId);
            if (!transceiver)
                throw new Error('new RTCRtpTransceiver not found');
            // Store in the map.
            this._mapMidTransceiver.set(localId, transceiver);
            return {
                localId,
                track: transceiver.receiver.track,
                rtpReceiver: transceiver.receiver
            };
        });
    }
    stopReceiving(localId) {
        return __awaiter(this, void 0, void 0, function* () {
            logger.debug('stopReceiving() [localId:%s]', localId);
            this.assertRecvDirection();
            const transceiver = this._mapMidTransceiver.get(localId);
            if (!transceiver)
                throw new Error('associated RTCRtpTransceiver not found');
            this._remoteSdp.closeMediaSection(transceiver.mid);
            const offer = { type: 'offer', sdp: this._remoteSdp.getSdp() };
            logger.debug('stopReceiving() | calling pc.setRemoteDescription() [offer:%o]', offer);
            yield this._pc.setRemoteDescription(offer);
            const answer = yield this._pc.createAnswer();
            logger.debug('stopReceiving() | calling pc.setLocalDescription() [answer:%o]', answer);
            yield this._pc.setLocalDescription(answer);
        });
    }
    getReceiverStats(localId) {
        return __awaiter(this, void 0, void 0, function* () {
            this.assertRecvDirection();
            const transceiver = this._mapMidTransceiver.get(localId);
            if (!transceiver)
                throw new Error('associated RTCRtpTransceiver not found');
            return transceiver.receiver.getStats();
        });
    }
    receiveDataChannel({ sctpStreamParameters, label, protocol }) {
        return __awaiter(this, void 0, void 0, function* () {
            logger.debug('receiveDataChannel()');
            this.assertRecvDirection();
            const { streamId, ordered, maxPacketLifeTime, maxRetransmits } = sctpStreamParameters;
            const options = {
                negotiated: true,
                id: streamId,
                ordered,
                maxPacketLifeTime,
                maxRetransmits,
                protocol
            };
            logger.debug('DataChannel options:%o', options);
            const dataChannel = this._pc.createDataChannel(label, options);
            // If this is the first DataChannel we need to create the SDP offer with
            // m=application section.
            if (!this._hasDataChannelMediaSection) {
                this._remoteSdp.receiveSctpAssociation();
                const offer = { type: 'offer', sdp: this._remoteSdp.getSdp() };
                logger.debug('receiveDataChannel() | calling pc.setRemoteDescription() [offer:%o]', offer);
                yield this._pc.setRemoteDescription(offer);
                const answer = yield this._pc.createAnswer();
                if (!this._transportReady) {
                    const localSdpObject = sdpTransform.parse(answer.sdp);
                    yield this._setupTransport({ localDtlsRole: 'client', localSdpObject });
                }
                logger.debug('receiveDataChannel() | calling pc.setRemoteDescription() [answer:%o]', answer);
                yield this._pc.setLocalDescription(answer);
                this._hasDataChannelMediaSection = true;
            }
            return { dataChannel };
        });
    }
    _setupTransport({ localDtlsRole, localSdpObject = null }) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!localSdpObject)
                localSdpObject = sdpTransform.parse(this._pc.localDescription.sdp);
            // Get our local DTLS parameters.
            const dtlsParameters = sdpCommonUtils.extractDtlsParameters({ sdpObject: localSdpObject });
            // Set our DTLS role.
            dtlsParameters.role = localDtlsRole;
            // Update the remote DTLS role in the SDP.
            this._remoteSdp.updateDtlsRole(localDtlsRole === 'client' ? 'server' : 'client');
            // Need to tell the remote transport about our parameters.
            yield this.safeEmitAsPromise('@connect', { dtlsParameters });
            this._transportReady = true;
        });
    }
    assertSendDirection() {
        if (this._direction !== 'send') {
            throw new Error('method can just be called for handlers with "send" direction');
        }
    }
    assertRecvDirection() {
        if (this._direction !== 'recv') {
            throw new Error('method can just be called for handlers with "recv" direction');
        }
    }
}
exports.Chrome74 = Chrome74;