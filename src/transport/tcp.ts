import * as net from 'net';
import { ServerTransport, ClientTransport, MsgId } from './base';
import { NoConnectionError } from '../error';
import { Session } from '../session';
import { Server } from '../server';

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

  constructor(private readonly session: Session<TcpClient>, private readonly port: number, private readonly host: string) {
    super();
  }

  connect(): Promise<boolean> | boolean {
    if (this.client == null) {
      this.client = net.createConnection(this.port, this.host)
        .on('data', data => {
          this.onRead(data);
        });
    } else if (!this.client.connecting) {
      this.client.connect(this.port, this.host);
    }

    return new Promise((resolve, reject) => {
      this.client!!
        .once('connect', () => {
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
  }

  close() {
    if (this.client) {
      this.client.end();
    }
  }
}
