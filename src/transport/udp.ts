import * as dgram from 'dgram';
import { ServerTransport, ClientTransport, MsgId } from './base';
import { Session } from '../session';
import { Server } from '../server';

export class UdpServer extends ServerTransport {
  private udpServer: dgram.Socket;

  constructor(private server: Server, port: number, host?: string, socketType: dgram.SocketType = 'udp4') {
    super();

    this.udpServer = dgram.createSocket(socketType);
    this.udpServer.on('message', (msg, remote) => {
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
    // this.udpServer.send()
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

  }

  close() {
    if (this.client) {
      this.client.close();
    }
  }
}
