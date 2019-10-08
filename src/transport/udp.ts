import * as dgram from 'dgram';
import { ServerTransport, ClientTransport, MsgId } from './base';
import { NoConnectionError } from '../error';
import { Session } from '../session';
import { Server } from '../server';

export class UdpServer extends ServerTransport {
  private udpServer: dgram.Socket;
  private remote?: dgram.RemoteInfo;

  constructor(private server: Server, port: number, host?: string, socketType: dgram.SocketType = 'udp4') {
    super();

    this.udpServer = dgram.createSocket(socketType);
    this.udpServer.on('message', (msg, remote) => {
      if (!this.remote) {
        this.remote = remote;
      }
      this.onRead(msg);
    });
    this.udpServer.bind(port, host);
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
    if (!this.remote) {
      throw new NoConnectionError('Connection not found.')
    }
    this.udpServer.send(data, 0, data.length, this.remote.port, this.remote.address);
  }

  close() {
    this.udpServer.close();
  }
}

export class UdpClient extends ClientTransport {
  private client?: dgram.Socket;

  constructor(private readonly session: Session<UdpClient>, private readonly port: number, private readonly host: string, private readonly socketType: dgram.SocketType = 'udp4') {
    super();
  }

  connect(): Promise<boolean> | boolean {
    this.client = dgram.createSocket(this.socketType);
    return true
  }

  onResponse(msgId: MsgId, error: Error | null, result: unknown) {
    this.session.onResponse(msgId, error, result);
  }

  sendData(data: Uint8Array) {
    if (!this.client) {
      throw new NoConnectionError('Client is not connected to server.');
    }
    this.client.send(data, 0, data.length, this.port, this.host);
  }

  close() {
    if (this.client) {
      this.client.close();
    }
  }
}
