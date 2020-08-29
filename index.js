#! /usr/bin/env node

'use strict'

const { Command } = require('commander')
const postgres = require('postgres')
const split = require('split2')
const { pipeline, Transform } = require('stream')

class PinoTransform extends Transform {
  constructor (schema, table, column, sql) {
    super()
    this.table = table
    this.schema = schema
    this.column = column
    this.sql = sql
  }

  _transform (chunk, encoding, callback) {
    const content = chunk.toString('utf-8')
    let log = {}
    try {
      log = JSON.parse(content)
    } catch {
      return callback(null, `${chunk}\n`)
    }

    this.sql`
        insert into ${this.sql(this.schema)}.${this.sql(this.table)}
            (${this.sql(this.column)})
            values (${this.sql.json(log)})
    `
      .then(() => callback(null, `${chunk}\n`))
      .catch(err => callback(err, null))
  }
}

if (require.main === module) {
  (async () => {
    const program = new Command()
    program
      .name('pino-postgres')
      .version('0.0.1')
      .option('--connection <connection>', 'postgres connection string')
      .option('--table <name>', 'table name', 'logs')
      .option('--schema <name>', 'schema name', 'public')
      .option('--column <name>', 'column name', 'content')
      .option('--ssl', 'use ssl', false)
      .option('--debug', 'debug postgres queries', false)

    const opts = program.parse(process.argv).opts()
    const postgresOpts = {}
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
    const sql = postgres(opts.connection, postgresOpts)
    const transport = new PinoTransform(opts.schema, opts.table, opts.column, sql)
    transport.on('end', sql.end)

    pipeline(process.stdin, split(), transport, process.stdout, err => {
      if (err) {
        console.error(err)
      }
    })
  })()
}
