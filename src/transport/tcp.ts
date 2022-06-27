import * as net from 'net';
import { ServerTransport, ClientTransport, MsgId } from './base';
import { NoConnectionError } from '../error';
import { Session } from '../session';
import { Server } from '../server';
import { decodeMultiStream } from '@msgpack/msgpack';

export class TcpServer extends ServerTransport {
  private socket?: net.Socket;
  private tcpServer: net.Server;

  constructor(private server: Server, port: number, host?: string) {
    super()

    this.tcpServer = net.createServer(socket => {
      this.socket = socket;
      socket.on('data', data => {
        this.onRead(data);
      })
    })
    .listen(port, host);
  }

  onRequest(msgId: MsgId, method: string, params: unknown[]) {
    this.server.dispatchMethod(
      msgId,
      method,
      params,
      (data: Uint8Array) => {
        this.sendData(data);
      }
    )
  }

  onNotify(method: string, params: unknown[]) {
    this.server.dispatchMethod(null, method, params);
  }

  sendData(data: Uint8Array) {
    if (!this.socket || this.socket.connecting || this.socket.destroyed) {
      throw new NoConnectionError('Server is not running.');
    }
    this.socket.write(data);
  }

  close() {
    this.tcpServer.close();
  }
}

export class TcpClient extends ClientTransport {
  private client?: net.Socket;
  private streamProcessor: Promise<void> | undefined ;

  constructor(private readonly session: Session<TcpClient>, private readonly port: number, private readonly host: string) {
    super();
  }

  connect(): Promise<boolean> | boolean {
    if (this.client == null) {
      this.client = net.createConnection(this.port, this.host);
    } else if (!this.client.connecting) {
      this.client.connect(this.port, this.host);
    }

    return new Promise((resolve, reject) => {
      if (!this.client) reject(new Error('Socket not defined'));

      const socket = this.client as net.Socket;
      socket.once('connect', async () => {
          this.streamProcessor = 
            (async () => {
              for await (const msg of decodeMultiStream(socket)) {
                this.onRead(msg);
              }
            })();
          resolve(true)
        })
        .once('error', (err: Error) => {
          reject(err)
        })
    });
  }

  onResponse(msgId: MsgId, error: Error | null, result: unknown) {
    this.session.onResponse(msgId, error, result);
  }

  sendData(data: Uint8Array) {
    if (this.client == null || this.client.destroyed || this.client.connecting) {
      throw new NoConnectionError('Client is not connected to server.');
    }
    this.client.write(data);

    // let stream = this.client;
    // new Promise( async (resolve, reject) => {
    //   let msg = await decodeAsync(stream);
    //   console.log('decodeasync result: ', msg);
    //   this.onRead(msg);
    // });  
  }

  close() {
    if (this.client) {
      this.client.end();
    }
  }
}
