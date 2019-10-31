import EnhancedEventEmitter from './EnhancedEventEmitter';
import { SctpStreamParameters } from './RtpParametersAndCapabilities';
export interface DataProducerOptions {
    ordered?: boolean;
    maxPacketLifeTime?: number;
    maxRetransmits?: number;
    priority?: RTCPriorityType;
    label?: string;
    protocol?: string;
    appData?: object;
}
export declare class DataProducer extends EnhancedEventEmitter {
    private _id;
    private _dataChannel;
    private _closed;
    private _sctpStreamParameters;
    private _appData;
    /**
     * @private
     *
     * @emits transportclose
     * @emits open
     * @emits {Object} error
     * @emits close
     * @emits bufferedamountlow
     * @emits @close
     */
    constructor({ id, dataChannel, sctpStreamParameters, appData }: {
        id: string;
        dataChannel: any;
        sctpStreamParameters: SctpStreamParameters;
        appData: object;
    });
    /**
     * DataProducer id.
     */
    readonly id: string;
    /**
     * Whether the DataProducer is closed.
     */
    readonly closed: boolean;
    /**
     * SCTP stream parameters.
     */
    readonly sctpStreamParameters: SctpStreamParameters;
    /**
     * DataChannel readyState.
     */
    readonly readyState: RTCDataChannelState;
    /**
     * DataChannel label.
     */
    readonly label: string;
    /**
     * DataChannel protocol.
     */
    readonly protocol: string;
    /**
     * DataChannel bufferedAmount.
     */
    readonly bufferedAmount: number;
    /**
     * DataChannel bufferedAmountLowThreshold.
     */
    /**
    * Set DataChannel bufferedAmountLowThreshold.
    */
    bufferedAmountLowThreshold: number;
    /**
     * App custom data.
     */
    /**
    * Invalid setter.
    */
    appData: object;
    /**
     * Closes the DataProducer.
     */
    close(): void;
    /**
     * Transport was closed.
     *
     * @private
     */
    transportClosed(): void;
    /**
     * Send a message.
     *
     * @param {String|Blob|ArrayBuffer|ArrayBufferView} data.
     *
     * @throws {InvalidStateError} if DataProducer closed.
     * @throws {TypeError} if wrong arguments.
     */
    send(data: any): void;
    /**
     * @private
     */
    _handleDataChannel(): void;
}
//# sourceMappingURL=DataProducer.d.ts.map