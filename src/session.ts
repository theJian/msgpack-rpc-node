import { encode } from '@msgpack/msgpack';
import * as messageType from './message';
import { ClientTransport, MsgId } from './transport/base';

export class Session<T extends ClientTransport> {
  private requestTable: { [key: number]: [(value?: unknown) => void, (reason?: unknown) => void] } = {}
  private generator: Iterator<number>;
  private transport: ClientTransport;

  constructor(
    builder: new (...args: any) => T,
    ...builderParams: ConstructorParameters<typeof builder>
  ) {
    this.generator = idGenerator();
    this.transport = new builder(this, ...builderParams);
  }

  connect() {
    return this.transport.connect();
  }

  call(method: string, ...params: unknown[]): Promise<unknown> {
    const msgId: number = this.generator.next().value;
    const data: Uint8Array = encode([messageType.REQUEST, msgId, method, params]);
    return new Promise((resolve, reject) => {
      this.requestTable[msgId] = [resolve, reject];
      this.transport.sendData(data);
    });
  }

  notify(method: string, ...params: unknown[]): void {
    const data: Uint8Array = encode([messageType.NOTIFY, method, params]);
    this.transport.sendData(data);
  }

  onResponse(msgId: MsgId, error: Error | null, result: unknown) {
    if (this.requestTable[msgId]) {
      const [ resolve, reject ] = this.requestTable[msgId];

      delete this.requestTable[msgId];

      if (error != null) {
        reject(error);
      } else {
        resolve(result);
      }
    }
  }

  close() {
    return this.transport.close();
  }
}

function* idGenerator() {
  let counter = 0;
  while (true) {
    yield counter++;
  }
}
