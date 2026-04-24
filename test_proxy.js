import { createServer } from 'vite'

async function test() {
  const server = await createServer({
    server: {
      proxy: {
        '/api': {
          target: 'http://example.com',
          changeOrigin: true,
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq) => {
              console.log('Proxy Headers:', proxyReq.getHeaders())
            })
          },
          bypass: (req) => {
            delete req.headers.cookie
            delete req.headers.origin
            delete req.headers.referer
          },
        },
      },
    },
  })
  await server.listen(9999)

  const http = require('node:http')
  const req = http.request('http://localhost:9999/api/test', {
    method: 'POST',
    headers: {
      cookie: 'test=123',
      referer: 'http://localhost:9999/',
    },
  }, (res) => {
    console.log('Response:', res.statusCode)
    server.close()
  })
  req.end()
}

test()
