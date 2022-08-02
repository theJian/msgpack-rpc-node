import { decode } from '@msgpack/msgpack';
import { RPCError } from '../error'
import * as messageType from '../message'

export type MsgId = number;

interface BaseTransport {
  sendData: (data: any) => void;
  close: () => void;
}

export abstract class ServerTransport implements BaseTransport {
  abstract sendData(data: any): void;
  abstract close(): void;
  abstract onRequest(msgId: MsgId, method: string, ...params: unknown[]): void;
  abstract onNotify(method: string, ...params: unknown[]): void;

  onRead(data: Buffer) {
    const message = decode(data);

    if (!Array.isArray(message) || (message.length != 4 && message.length != 3)) {
      throw new RPCError(`Invalid MessagePack-RPC protocol: message = ${message}`);
    }

    switch(message[0]) {
      case messageType.REQUEST: this.onRequest(message[1], message[2], message[3]); break;
      case messageType.NOTIFY: this.onNotify(message[1], message[2]); break;
      default:
        throw new RPCError(`Unknown message type: type = ${message[0]}`)
    }
  }
}

export abstract class ClientTransport implements BaseTransport {
  abstract sendData(data: any): void;
  abstract close(): void;
  abstract onResponse(msgId: MsgId, error: Error, result: unknown): void;
  abstract connect(): boolean | Promise<boolean>;

  onRead(data: Buffer | unknown) {
    const message = (data instanceof Buffer) ? decode(data) : data;

    if (!Array.isArray(message) || (message.length != 4 && message.length != 3)) {
      throw new RPCError(`Invalid MessagePack-RPC protocol: message = ${message}`);
    }

    switch(message[0]) {
      case messageType.RESPONSE: this.onResponse(message[1], message[2], message[3]); break;
      default:
        throw new RPCError(`Unknown message type: type = ${message[0]}`);
    }
  }
}
