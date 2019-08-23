import * as net from 'net';
import { existsSync } from 'fs';
import { ServerTransport, ClientTransport, MsgId } from './base';
import { NoConnectionError, ServerError } from '../error';
import { Session } from '../session';
import { Server } from '../server';

export class UnixServer extends ServerTransport {
  private socket?: net.Socket;
  private socketServer: net.Server;
  private isConnected: boolean;

  constructor(private server: Server, path: string) {
    super();

    if (existsSync(path)) {
      throw new ServerError(`Path exists. path = ${path}`)
    }

    this.isConnected = false;
    this.socketServer = net.createServer(socket => {
      this.socket = socket;
      socket.on('data', data => {
        this.onRead(data);
      })
    })
    .on('connection', () => { this.isConnected = true; })
    .on('close', () => { this.isConnected = false; })
    .listen(path);
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
    if (!this.isConnected || !this.socket) {
      throw new NoConnectionError('Server is not running.');
    }
    this.socket.write(data);
  }

  close() {
    this.socketServer.close();
  }
}

export class UnixClient extends ClientTransport {
  private client: net.Socket;
  private isConnected: boolean;

  constructor(private session: Session<UnixClient>, path: string) {
    super();
    this.isConnected = false;
    this.client = net.createConnection(path)
    .on('connect', () => { this.isConnected = true })
    .on('close', () => { this.isConnected = false; })
    .on('data', data => {
      this.onRead(data);
    });
  }

  onResponse(msgId: MsgId, error: Error | null, result: unknown) {
    this.session.onResponse(msgId, error, result);
  }

  sendData(data: Uint8Array) {
    if (!this.isConnected) {
      throw new NoConnectionError('Client is not connected to server.');
    }
    this.client.write(data);
  }

  close() {
    this.client.end();
  }
}
