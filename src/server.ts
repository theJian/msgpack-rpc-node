import { encode } from '@msgpack/msgpack';
import * as messageType from './message';
import { ServerTransport, MsgId } from './transport/base'
import { NoMethodError } from './error'

export type Dispatcher = { [key: string]: (...args: unknown[]) => unknown }

export class Server {
  transport?: ServerTransport;

  constructor(private dispatcher: Dispatcher = {}) {}

  serve(dispatcher: Dispatcher): Server {
    this.dispatcher = { ...this.dispatcher, ...dispatcher };
    return this;
  }

  listen<T extends ServerTransport>(
    builder: new (...args: any) => T,
    ...builderParams: ConstructorParameters<typeof builder>
  ) {
    this.transport = new builder(this, ...builderParams);
  }

  dispatchMethod(
    msgId: MsgId | null,
    method: string,
    params: unknown[],
    responseFn?: (data: Uint8Array) => void
  ) {
    if (!this.dispatcher[method]) {
      responseFn && responseFn(
        encode([messageType.RESPONSE, msgId, new NoMethodError('Method not found.'), null])
      );
      return;
    }

    const earlyResult = this.dispatcher[method](...params);
    if (responseFn) {
      Promise.resolve(earlyResult).then(
        result => { responseFn(encode([messageType.RESPONSE, msgId, null, result])) },
        error => { responseFn(encode([messageType.RESPONSE, msgId, error, null])) }
      )
    }
  }
}
