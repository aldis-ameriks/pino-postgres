#! /usr/bin/env node

'use strict'

const { Command } = require('commander')
const postgres = require('postgres')
const split = require('split2')
const { pipeline, Transform } = require('stream')
const { types } = require('util')
const packageJson = require('./package.json')

let buffer = []
let interval

class PinoTransform extends Transform {
  constructor (opts, sql) {
    super()
    this.opts = opts
    this.sql = sql
  }

  _transform (chunk, encoding, callback) {
    const { column, passThrough } = this.opts
    const content = chunk.toString('utf-8')

    buffer.push({ [column]: content })
    if (buffer.length > this.opts.bufferSize) {
      flushBuffer(this.sql, this.opts)
    }
    callback(null, passThrough ? `${chunk}\n` : null)
  }
}

function flushBuffer (sql, opts) {
  if (buffer.length) {
    const query = sql`
            INSERT INTO ${sql(opts.schema)}.${sql(opts.table)} ${sql(buffer, opts.column)}
            ON CONFLICT DO NOTHING;
            `.catch((err) => {
        console.error('error in pino-postgres sql', err)
      })
    buffer = []
    return query
  }
}

function parseNumber (value) {
  return Number.parseInt(value, 10)
}

function shutdown (sql, opts) {
  clearInterval(interval)
  const result = flushBuffer(sql, opts)
  if (types.isPromise(result)) {
    result.then(() => {
      sql.end()
      process.exit(0)
    })
  } else {
    sql.end()
    process.exit(0)
  }
}

if (require.main === module) {
  (async () => {
    const program = new Command()
    program
      .name('pino-postgres')
      .version(packageJson.version)
      .requiredOption('--connection <connection>', 'postgres connection string')
      .option('--table <name>', 'table name', 'logs')
      .option('--schema <name>', 'schema name', 'public')
      .option('--column <name>', 'column name', 'content')
      .option('--flush-interval <number>', 'interval at which logs are flushed in ms', parseNumber, 5000)
      .option('--buffer-size <number>', 'max number of log entries in buffer', parseNumber, 1000)
      .option('--max-connections <number>', 'max number of connections', parseNumber, 3)
      .option('--ssl', 'use ssl', false)
      .option('--debug', 'debug postgres client', false)
      .option('--pass-through', 'pass logs through', false)

    const opts = program.parse(process.argv).opts()

    const postgresOpts = {
      max: opts.maxConnections
    }

    if (opts.ssl) {
      postgresOpts.ssl = { rejectUnauthorized: false }
    }

    if (opts.debug) {
      postgresOpts.debug = (connection, query, params) => {
        console.log('DEBUG - connection: ', connection)
        console.log('DEBUG - query: ', query)
        console.log('DEBUG - params: ', params)
      }
    }

    if (opts.debug) {
      console.log('DEBUG - starting pino-postgres')
    }

    try {
      const sql = postgres(opts.connection, postgresOpts)
      const transport = new PinoTransform(opts, sql)
      transport.on('end', () => {
        shutdown(sql, opts)
      })

      process.on('SIGINT', () => {
        shutdown(sql, opts)
      })
      process.on('SIGTERM', () => {
        shutdown(sql, opts)
      })

      interval = setInterval(() => {
        if (opts.debug) {
          console.log(`DEBUG - buffer size: ${buffer.length}`)
        }
        flushBuffer(sql, opts)
      }, opts.flushInterval)
      interval.unref()

      pipeline(process.stdin, split(), transport, process.stdout, err => {
        if (err) {
          console.error('error in pino-postgres pipeline', err)
        }
      })
    } catch (err) {
      console.error('error in pino-postgres', err)
    }
  })()
}
