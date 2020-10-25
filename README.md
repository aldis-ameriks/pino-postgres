<h1 align="center">Welcome to pino-postgres 👋</h1>
<p>
    <a href="https://www.npmjs.com/package/pino-postgres" target="_blank">
        <img alt="Version" src="https://img.shields.io/npm/v/pino-postgres.svg">
    </a>
</p>

> Pino transport for Postgres

## Install

```sh
$ npm install pino-postgres
# or
$ yarn add pino-postgres
```

## Usage

```
Usage: pino-postgres [options]

Options:
  -V, --version               output the version number
  --connection <connection>   postgres connection string
  --table <name>              table name (default: "logs")
  --schema <name>             schema name (default: "public")
  --content-column <name>     content column name (default: "content")
  --time-column <name>        time column name (default: "time")
  --time-field <name>         time field name (default: "time")
  --flush-interval <number>   interval at which logs are flushed in ms (default: 5000)
  --buffer-size <number>      max number of log entries in buffer (default: 1000)
  --max-connections <number>  max number of connections (default: 3)
  --ssl                       use ssl (default: false)
  --debug                     debug postgres client (default: false)
  --pass-through              pass logs through (default: false)
  -h, --help                  display help for command
```

```
node app.js | pino-postgres --connection postgres://username:password@localhost:5432/database
```

> pino-postgres does not create the necessary database tables, ensure that the table with jsonb and timestamptz columns exist.

## Contributing

Contributions, issues and feature requests are welcome!

## License

Copyright © 2020 [Aldis Ameriks](https://github.com/aldis-ameriks).<br />
This project is [MIT](https://github.com/aldis-ameriks/pino-postgres/blob/master/LICENSE) licensed.

