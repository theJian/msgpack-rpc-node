import { existsSync, unlinkSync } from 'fs';
import { Client, Server, UnixClient, UnixServer, NoMethodError } from '..'

describe('unix sockets', () => {
  const socket = '/tmp/msgpackrpc.sock';

  const createServer = (dispatcher: any) => new Server(dispatcher).listen(UnixServer, socket);
  const createClient = () => new Client(UnixClient, socket);

  beforeEach(() => {
    if (existsSync(socket)) {
      unlinkSync(socket)
    }
  })

  test('basic request', async () => {
    const server = createServer(
      {
        hello() {
          return 'world';
        },
        sum(a: number, b: number) {
          return a + b;
        },
      }
    )
    const client = createClient();
    await client.connect();

    const resultHello = await client.call('hello');
    expect(resultHello).toBe('world');

    const resultSum = await client.call('sum', 3, 5);
    expect(resultSum).toBe(8)

    server.close();
    client.close();
  });

  test('async request handler', async () => {
    const server = createServer({
      sum(a: number, b: number) {
        return new Promise(resolve => {
          process.nextTick(() => {
            resolve(a + b)
          })
        })
      }
    })
    const client = createClient();
    await client.connect();

    const resultAsyncSum = await client.call('sum', 5, 7);
    expect(resultAsyncSum).toBe(12);

    server.close();
    client.close();
  });

  test('notify', (done) => {
    const clientMessage = 'hello';
    const server = createServer({
      say(message: string) {
        expect(message).toBe(clientMessage);

        server.close();
        client.close();

        done();
      }
    });
    const client = createClient();
    Promise.resolve(client.connect()).then(() => {
      client.notify('say', clientMessage);
    })
  });

  test('server throws error', async () => {
    const server = createServer({
      async asyncThrowError() {
        await 1;
        throw 'async throw error';
      },

      throwError() {
        throw 'throw error';
      }
    });
    const client = createClient();
    await client.connect();

    await expect(client.call('asyncThrowError')).rejects.toBe('async throw error');
    await expect(client.call('throwError')).rejects.toBe('throw error');

    server.close();
    client.close();
  });

  test.skip('unknown method', async () => {
    const server = createServer({});
    const client = createClient();
    await client.connect();

    await expect(client.call('unknown')).rejects.toBeInstanceOf(NoMethodError);

    server.close();
    client.close();
  })
});

