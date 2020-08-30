#! /usr/bin/env node

'use strict'

const { Command } = require('commander')
const postgres = require('postgres')
const split = require('split2')
const { pipeline, Transform } = require('stream')
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
    let log = {}
    try {
      log = JSON.parse(content)
    } catch (err) {
      return callback(null, passThrough ? `${chunk}\n` : null)
    }

    buffer.push({ [column]: log })
    callback(null, passThrough ? `${chunk}\n` : null)
  }
}

if (require.main === module) {
  (async () => {
    const program = new Command()
    program
      .name('pino-postgres')
      .version(packageJson.version)
      .option('--connection <connection>', 'postgres connection string')
      .option('--table <name>', 'table name', 'logs')
      .option('--schema <name>', 'schema name', 'public')
      .option('--column <name>', 'column name', 'content')
      .option('--ssl', 'use ssl', false)
      .option('--debug', 'debug postgres client', false)
      .option('--pass-through', 'pass logs through', false)

    const opts = program.parse(process.argv).opts()
    const postgresOpts = {
      max: 1
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
        sql.end()
        clearInterval(interval)
      })

      interval = setInterval(() => {
        if (opts.debug) {
          console.log(`DEBUG - buffer size: ${buffer.length}`)
        }
        if (buffer.length) {
          this.sql`
            INSERT INTO ${this.sql(opts.schema)}.${this.sql(opts.table)} (${this.sql(opts.column)}) VALUES (${this.sql(buffer)})
            ON CONFLICT DO NOTHING;
            `.catch((err) => {
              console.error('error in pino-postgres sql', err)
            })
          buffer = []
        }
      }, 5000)
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
