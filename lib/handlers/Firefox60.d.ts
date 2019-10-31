import { IceParameters, IceCandidate, DtlsParameters, TransportSctpParameters } from '../Transport';
export default class Firefox60 {
    static readonly label: string;
    static getNativeRtpCapabilities(): Promise<any>;
    static getNativeSctpCapabilities(): Promise<any>;
    constructor({ direction, iceParameters, iceCandidates, dtlsParameters, sctpParameters, iceServers, iceTransportPolicy, additionalSettings, proprietaryConstraints, extendedRtpCapabilities }: {
        direction: 'send' | 'recv';
        iceParameters: IceParameters;
        iceCandidates: IceCandidate[];
        dtlsParameters: DtlsParameters;
        sctpParameters: TransportSctpParameters;
        iceServers: RTCIceServer[];
        iceTransportPolicy: RTCIceTransportPolicy;
        additionalSettings: any;
        proprietaryConstraints: any;
        extendedRtpCapabilities: any;
    });
}
//# sourceMappingURL=Firefox60.d.ts.map