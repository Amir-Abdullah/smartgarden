const sqlite3 = require('sqlite3').verbose();

// -----------------------------------------------------------------------------
// Operators
// -----------------------------------------------------------------------------
const Op = {
  eq: Symbol('eq'),
  ne: Symbol('ne'),
  gte: Symbol('gte'),
  gt: Symbol('gt'),
  lte: Symbol('lte'),
  lt: Symbol('lt'),
  not: Symbol('not'),
  is: Symbol('is'),
  in: Symbol('in'),
  notIn: Symbol('notIn'),
  like: Symbol('like'),
  notLike: Symbol('notLike'),
  iLike: Symbol('iLike'),
  notILike: Symbol('notILike'),
  between: Symbol('between'),
  notBetween: Symbol('notBetween'),
  and: Symbol('and'),
  or: Symbol('or')
};

// -----------------------------------------------------------------------------
// DataTypes
// -----------------------------------------------------------------------------
class DataType {
  constructor(key) { this.key = key; }
  toString() { return this.key; }
}

const DataTypes = {
  STRING: (len) => ({ type: 'STRING', length: len, toSql: () => len ? `VARCHAR(${len})` : 'VARCHAR(255)' }),
  TEXT: { type: 'TEXT', toSql: () => 'TEXT' },
  INTEGER: {
    type: 'INTEGER',
    UNSIGNED: { type: 'INTEGER', unsigned: true, toSql: () => 'INTEGER' },
    toSql: () => 'INTEGER'
  },
  BIGINT: {
    type: 'BIGINT',
    UNSIGNED: { type: 'BIGINT', unsigned: true, toSql: () => 'BIGINT' },
    toSql: () => 'BIGINT'
  },
  FLOAT: { type: 'FLOAT', toSql: () => 'FLOAT' },
  DECIMAL: (p = 10, s = 2) => ({ type: 'DECIMAL', precision: p, scale: s, toSql: () => `DECIMAL(${p}, ${s})` }),
  BOOLEAN: { type: 'BOOLEAN', toSql: () => 'BOOLEAN' },
  DATE: { type: 'DATE', toSql: (dialect) => (dialect === 'postgres' || dialect === 'postgresql') ? 'TIMESTAMPTZ' : 'DATETIME' },
  DATEONLY: { type: 'DATEONLY', toSql: () => 'DATE' },
  TIME: { type: 'TIME', toSql: () => 'TIME' },
  ENUM: (...values) => {
    const vals = Array.isArray(values[0]) ? values[0] : values;
    return {
      type: 'ENUM',
      values: vals,
      toSql: (dialect) => (dialect === 'sqlite' || dialect === 'postgres' || dialect === 'postgresql') ? 'VARCHAR(50)' : (vals && vals.length ? `ENUM(${vals.map(v => `'${v}'`).join(',')})` : 'VARCHAR(50)')
    };
  },
  JSON: { type: 'JSON', toSql: () => 'JSON' },
  NOW: Symbol('NOW')
};
DataTypes.STRING.toSql = () => 'VARCHAR(255)';
DataTypes.DECIMAL.toSql = () => 'DECIMAL(10, 2)';

// -----------------------------------------------------------------------------
// Model Base Class
// -----------------------------------------------------------------------------
class Model {
  constructor(values = {}, options = {}) {
    this._values = {};
    this.isNewRecord = options.isNewRecord !== false;
    this.setAttributes(values);
    return new Proxy(this, {
      get: (target, prop) => {
        if (prop in target) return target[prop];
        return target._values[prop];
      },
      set: (target, prop, value) => {
        if (prop in target) {
          target[prop] = value;
        } else {
          target._values[prop] = value;
        }
        return true;
      }
    });
  }

  setAttributes(values) {
    for (const [k, v] of Object.entries(values)) {
      this._values[k] = v;
    }
  }

  get(key) {
    if (key) return this._values[key];
    return { ...this._values };
  }

  set(key, val) {
    if (typeof key === 'object') {
      Object.assign(this._values, key);
    } else {
      this._values[key] = val;
    }
    return this;
  }

  toJSON() {
    const result = { ...this._values };
    for (const key of Object.keys(this)) {
      if (key !== '_values' && key !== 'isNewRecord') {
        result[key] = this[key];
      }
    }
    return result;
  }

  async save(options = {}) {
    const modelClass = this.constructor;
    const pk = modelClass.primaryKeyAttribute || 'id';
    const queryOpts = options && options.transaction ? { transaction: options.transaction } : {};
    if (this.isNewRecord) {
      const created = await modelClass.create(this._values, queryOpts);
      this._values = created._values;
      this.isNewRecord = false;
      return this;
    } else {
      await modelClass.update(this._values, { where: { [pk]: this._values[pk] }, ...queryOpts });
      return this;
    }
  }

  async update(values, options = {}) {
    this.setAttributes(values);
    return await this.save(options);
  }

  async destroy(options = {}) {
    const modelClass = this.constructor;
    const pk = modelClass.primaryKeyAttribute || 'id';
    const queryOpts = options && options.transaction ? { transaction: options.transaction } : {};
    await modelClass.destroy({ where: { [pk]: this._values[pk] }, ...queryOpts });
    return this;
  }
}

// -----------------------------------------------------------------------------
// QueryInterface (Used for programmatic migrations)
// -----------------------------------------------------------------------------
class QueryInterface {
  constructor(sequelize) {
    this.sequelize = sequelize;
  }

  async createTable(tableName, attributes, options = {}) {
    const dialect = this.sequelize.options.dialect || 'sqlite';
    const isSqlite = dialect === 'sqlite';

    const colDefs = [];
    const tableConstraints = [];

    for (const [colName, attr] of Object.entries(attributes)) {
      const typeDef = typeof attr.type === 'object' && attr.type.toSql
        ? attr.type.toSql(dialect)
        : (attr.type && attr.type.toSql ? attr.type.toSql(dialect) : (attr.type || 'TEXT'));

      let colSql = `${colName} ${typeDef}`;

      const isPostgres = dialect === 'postgres' || dialect === 'postgresql';

      if (attr.primaryKey) {
        if (isSqlite && (attr.autoIncrement || typeDef.includes('INT'))) {
          colSql = `${colName} INTEGER PRIMARY KEY AUTOINCREMENT`;
        } else if (isPostgres) {
          colSql = attr.autoIncrement ? `${colName} SERIAL PRIMARY KEY` : `${colName} ${typeDef} PRIMARY KEY`;
        } else {
          colSql += ' PRIMARY KEY';
          if (attr.autoIncrement) colSql += ' AUTO_INCREMENT';
        }
      }

      if (attr.allowNull === false && !attr.primaryKey) {
        colSql += ' NOT NULL';
      }

      if (attr.defaultValue !== undefined) {
        if (attr.defaultValue === DataTypes.NOW) {
          colSql += ' DEFAULT CURRENT_TIMESTAMP';
        } else if (typeof attr.defaultValue === 'string') {
          colSql += ` DEFAULT '${attr.defaultValue}'`;
        } else if (typeof attr.defaultValue === 'boolean') {
          colSql += isPostgres
            ? (attr.defaultValue ? ' DEFAULT TRUE' : ' DEFAULT FALSE')
            : (attr.defaultValue ? ' DEFAULT 1' : ' DEFAULT 0');
        } else if (attr.defaultValue !== null) {
          colSql += ` DEFAULT ${attr.defaultValue}`;
        }
      }

      if (attr.unique && !attr.primaryKey) {
        colSql += ' UNIQUE';
      }

      if (attr.references) {
        const refTable = attr.references.model;
        const refCol = attr.references.key || 'id';
        if (isSqlite) {
          colSql += ` REFERENCES ${refTable}(${refCol})`;
          if (attr.onDelete) colSql += ` ON DELETE ${attr.onDelete}`;
          if (attr.onUpdate) colSql += ` ON UPDATE ${attr.onUpdate}`;
        } else {
          let fk = `FOREIGN KEY (${colName}) REFERENCES ${refTable}(${refCol})`;
          if (attr.onDelete) fk += ` ON DELETE ${attr.onDelete}`;
          if (attr.onUpdate) fk += ` ON UPDATE ${attr.onUpdate}`;
          tableConstraints.push(fk);
        }
      }

      colDefs.push(colSql);
    }

    // CHECK constraints (SQLite only; MariaDB prohibits CHECK on foreign key columns MDEV-16058)
    if (options.checks && isSqlite) {
      for (const check of options.checks) {
        tableConstraints.push(`CONSTRAINT ${check.name} CHECK (${check.expression})`);
      }
    }

    const allDefs = [...colDefs, ...tableConstraints];
    const sql = `CREATE TABLE IF NOT EXISTS ${tableName} (\n  ${allDefs.join(',\n  ')}\n);`;
    await this.sequelize.query(sql);
  }

  async dropTable(tableName) {
    await this.sequelize.query(`DROP TABLE IF EXISTS ${tableName};`);
  }

  async addIndex(tableName, fields, options = {}) {
    const indexName = options.name || `idx_${tableName}_${Array.isArray(fields) ? fields.join('_') : fields}`;
    const unique = options.unique ? 'UNIQUE ' : '';
    const fieldList = Array.isArray(fields) ? fields.join(', ') : fields;
    const sql = `CREATE ${unique}INDEX IF NOT EXISTS ${indexName} ON ${tableName} (${fieldList});`;
    await this.sequelize.query(sql);
  }

  async removeIndex(tableName, indexName) {
    await this.sequelize.query(`DROP INDEX IF EXISTS ${indexName};`);
  }

  async bulkInsert(tableName, records) {
    if (!records || records.length === 0) return;
    const dialect = this.sequelize.options.dialect || 'sqlite';
    const isPostgres = dialect === 'postgres' || dialect === 'postgresql';
    const cols = Object.keys(records[0]);
    for (const rec of records) {
      const vals = cols.map(c => {
        const val = rec[c];
        if (val === null || val === undefined) return 'NULL';
        if (typeof val === 'object') return `'${JSON.stringify(val).replace(/'/g, "''")}'`;
        if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(val)) return `'${val.slice(0, 19).replace('T', ' ')}'`;
        if (typeof val === 'string') return `'${val.replace(/'/g, "''")}'`;
        if (typeof val === 'boolean') return isPostgres ? (val ? 'TRUE' : 'FALSE') : (val ? '1' : '0');
        return val;
      });
      const sql = `INSERT INTO ${tableName} (${cols.join(', ')}) VALUES (${vals.join(', ')});`;
      await this.sequelize.query(sql);
    }
  }

  async bulkDelete(tableName, identifier) {
    let whereSql = '';
    if (identifier && Object.keys(identifier).length > 0) {
      const parts = Object.entries(identifier).map(([k, v]) => `${k} = '${String(v).replace(/'/g, "''")}'`);
      whereSql = ` WHERE ${parts.join(' AND ')}`;
    }
    await this.sequelize.query(`DELETE FROM ${tableName}${whereSql};`);
  }

  async showAllTables() {
    const dialect = this.sequelize.options.dialect || 'sqlite';
    if (dialect === 'sqlite') {
      const rows = await this.sequelize.query("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';");
      return rows.map(r => r.name);
    }
    if (dialect === 'postgres' || dialect === 'postgresql') {
      const rows = await this.sequelize.query("SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname = 'public';");
      return rows.map(r => r.tablename || r.TABLENAME);
    }
    const rows = await this.sequelize.query('SHOW TABLES;');
    return rows.map(r => Object.values(r)[0]);
  }
}

// -----------------------------------------------------------------------------
// Sequelize Main Class
// -----------------------------------------------------------------------------
class Sequelize {
  constructor(database, username, password, options = {}) {
    if (typeof database === 'object' && database !== null) {
      options = database;
      database = options.database;
      username = options.username;
      password = options.password;
    }
    const resolvedUser = username || options.username || options.user || 'smartgarden_user';
    const resolvedPass = password !== undefined ? password : (options.password !== undefined ? options.password : 'smartgarden_pass');
    this.options = {
      dialect: options.dialect || 'sqlite',
      storage: options.storage || ':memory:',
      host: options.host || '127.0.0.1',
      port: options.port || 3306,
      database: database || options.database || 'smartgarden',
      username: resolvedUser,
      user: resolvedUser,
      password: resolvedPass,
      logging: options.logging || false,
      ...options
    };
    this.options.user = resolvedUser;
    this.options.password = resolvedPass;
    this.models = {};
    this.queryInterface = new QueryInterface(this);
    this._sqliteDb = null;
    this._mariaPool = null;
    this._pgPool = null;
  }

  _getPgPool() {
    if (!this._pgPool) {
      const { Pool } = require('pg');
      const poolOpts = this.options.pool || {};
      const dialectOpts = this.options.dialectOptions || {};
      this._pgPool = new Pool({
        host: this.options.host || '127.0.0.1',
        port: Number(this.options.port || 5432),
        user: this.options.user || this.options.username || 'postgres',
        password: this.options.password !== undefined ? String(this.options.password) : '',
        database: this.options.database || 'postgres',
        max: poolOpts.max || 10,
        idleTimeoutMillis: poolOpts.idle || 10000,
        connectionTimeoutMillis: dialectOpts.connectTimeout || 10000,
        ssl: dialectOpts.ssl !== undefined ? dialectOpts.ssl : { rejectUnauthorized: false }
      });
    }
    return this._pgPool;
  }

  _getMariaPool() {
    if (!this._mariaPool) {
      const mariadb = require('mariadb');
      const poolOpts = this.options.pool || {};
      const dialectOpts = this.options.dialectOptions || {};
      this._mariaPool = mariadb.createPool({
        host: this.options.host || '127.0.0.1',
        port: Number(this.options.port || 3306),
        user: this.options.user || this.options.username || 'smartgarden_user',
        password: this.options.password || 'smartgarden_pass',
        database: this.options.database || 'smartgarden',
        connectionLimit: poolOpts.max || 1,
        idleTimeout: poolOpts.idle ? Math.max(1, Math.floor(poolOpts.idle / 1000)) : 3,
        connectTimeout: dialectOpts.connectTimeout || 10000,
        ssl: dialectOpts.ssl !== undefined ? dialectOpts.ssl : { rejectUnauthorized: false }
      });
    }
    return this._mariaPool;
  }

  getQueryInterface() {
    return this.queryInterface;
  }

  async _getSqliteDb() {
    if (!this._sqliteDb) {
      await new Promise((resolve, reject) => {
        this._sqliteDb = new sqlite3.Database(this.options.storage, (err) => {
          if (err) return reject(err);
          this._sqliteDb.run('PRAGMA foreign_keys = ON;', (err2) => {
            if (err2) return reject(err2);
            resolve();
          });
        });
      });
    }
    return this._sqliteDb;
  }

  async authenticate() {
    if (this.options.dialect === 'sqlite') {
      await this._getSqliteDb();
      return true;
    }
    if (this.options.dialect === 'postgres' || this.options.dialect === 'postgresql') {
      const pgPool = this._getPgPool();
      const client = await pgPool.connect();
      client.release();
      return true;
    }
    // MariaDB dialect
    const authPool = this._getMariaPool();
    const mariaConnection = await authPool.getConnection();
    await mariaConnection.release();
    return true;
  }

  async close() {
    if (this._sqliteDb) {
      await new Promise((resolve) => this._sqliteDb.close(() => resolve()));
      this._sqliteDb = null;
    }
    if (this._mariaPool) {
      await this._mariaPool.end();
      this._mariaPool = null;
    }
    if (this._pgPool) {
      await this._pgPool.end();
      this._pgPool = null;
    }
  }

  async query(sql, options = {}) {
    if (this.options.logging && typeof this.options.logging === 'function') {
      this.options.logging(sql);
    } else if (this.options.logging === true) {
      console.log('[Sequelize Query]', sql);
    }

    if (this.options.dialect === 'sqlite') {
      const db = await this._getSqliteDb();
      return new Promise((resolve, reject) => {
        const trimmed = sql.trim().toUpperCase();
        if (trimmed.startsWith('SELECT') || trimmed.startsWith('PRAGMA') || trimmed.startsWith('SHOW')) {
          db.all(sql, [], (err, rows) => {
            if (err) return reject(err);
            resolve(rows || []);
          });
        } else {
          db.run(sql, [], function (err) {
            if (err) return reject(err);
            resolve({ lastID: this.lastID, changes: this.changes });
          });
        }
      });
    } else if (this.options.dialect === 'postgres' || this.options.dialect === 'postgresql') {
      const executor = (options && options.transaction && (options.transaction._client || options.transaction._connection))
        ? (options.transaction._client || options.transaction._connection)
        : this._getPgPool();
      const res = await executor.query(sql);
      const upper = sql.trim().toUpperCase();
      if (upper.startsWith('SELECT') || upper.startsWith('PRAGMA') || upper.includes('RETURNING')) {
        return res.rows || [];
      }
      return {
        affectedRows: res.rowCount || 0,
        rowCount: res.rowCount || 0,
        changes: res.rowCount || 0,
        rows: res.rows || []
      };
    } else {
      if (options && options.transaction) {
        if (options.transaction._finished) {
          throw new Error('Transaction has already been finished.');
        }
        if (options.transaction._connection) {
          return await options.transaction._connection.query(sql);
        }
      }
      const queryPool = this._getMariaPool();
      return await queryPool.query(sql);
    }
  }

  define(modelName, attributes, options = {}) {
    const tableName = options.tableName || `${modelName.toLowerCase()}s`;
    const sequelize = this;

    class DefinedModel extends Model {
      static get tableName() { return tableName; }
      static get primaryKeyAttribute() {
        for (const [col, attr] of Object.entries(attributes)) {
          if (attr.primaryKey) return col;
        }
        return 'id';
      }

      static async sync(syncOpts = {}) {
        if (syncOpts.force) {
          await sequelize.getQueryInterface().dropTable(tableName);
        }
        await sequelize.getQueryInterface().createTable(tableName, attributes, options);
      }

      static async create(values, queryOpts = {}) {
        const cols = [];
        const vals = [];
        const dialect = sequelize.options.dialect || 'sqlite';
        const isPostgres = dialect === 'postgres' || dialect === 'postgresql';
        const isMaria = dialect === 'mariadb' || dialect === 'mysql';
        const now = isMaria ? new Date().toISOString().slice(0, 19).replace('T', ' ') : new Date().toISOString();

        const data = { ...values };
        for (const [col, attr] of Object.entries(attributes)) {
          if (data[col] === undefined && attr.defaultValue !== undefined && attr.defaultValue !== DataTypes.NOW) {
            data[col] = attr.defaultValue;
          }
        }
        const hasTimestamps = options.timestamps !== false && (options.timestamps || (sequelize.options.define && sequelize.options.define.timestamps));
        const isUnderscored = options.underscored || (sequelize.options.define && sequelize.options.define.underscored);
        const createdAtField = isUnderscored ? 'created_at' : 'createdAt';
        const updatedAtField = isUnderscored ? 'updated_at' : 'updatedAt';

        if (hasTimestamps) {
          if (options.createdAt !== false && !data[createdAtField]) data[createdAtField] = now;
          if (options.updatedAt !== false && !data[updatedAtField]) data[updatedAtField] = now;
        }
        if (attributes.created_at && !data.created_at) data.created_at = now;
        if (attributes.updated_at && !data.updated_at) data.updated_at = now;
        if (attributes.createdAt && !data.createdAt) data.createdAt = now;
        if (attributes.updatedAt && !data.updatedAt) data.updatedAt = now;

        for (const [col, val] of Object.entries(data)) {
          if (this.associations && col in this.associations) continue;
          cols.push(col);
          if (val === null || val === undefined) {
            vals.push('NULL');
          } else if (val instanceof Date) {
            vals.push(isMaria ? `'${val.toISOString().slice(0, 19).replace('T', ' ')}'` : `'${val.toISOString()}'`);
          } else if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(val)) {
            vals.push(isMaria ? `'${val.slice(0, 19).replace('T', ' ')}'` : `'${val}'`);
          } else if (typeof val === 'object') {
            vals.push(`'${JSON.stringify(val).replace(/'/g, "''")}'`);
          } else if (typeof val === 'string') {
            vals.push(`'${val.replace(/'/g, "''")}'`);
          } else if (typeof val === 'boolean') {
            vals.push(val ? (isPostgres ? 'TRUE' : '1') : (isPostgres ? 'FALSE' : '0'));
          } else {
            vals.push(val);
          }
        }

        let sql = `INSERT INTO ${tableName} (${cols.join(', ')}) VALUES (${vals.join(', ')})`;
        if (isPostgres) {
          sql += ' RETURNING *;';
        } else {
          sql += ';';
        }
        const res = await sequelize.query(sql, queryOpts && queryOpts.transaction ? { transaction: queryOpts.transaction } : {});
        const pk = this.primaryKeyAttribute;
        let insertedId;
        if (isPostgres && Array.isArray(res) && res.length > 0) {
          insertedId = res[0][pk];
          for (const [k, v] of Object.entries(res[0])) {
            data[k] = v;
          }
        } else {
          const rawInsertId = res && res.lastID !== undefined && res.lastID !== null
            ? Number(res.lastID)
            : (res && res.insertId !== undefined && res.insertId !== null ? Number(res.insertId) : undefined);
          insertedId = (rawInsertId !== undefined && !Number.isNaN(rawInsertId) && rawInsertId > 0)
            ? rawInsertId
            : data[pk];
        }
        if (insertedId !== undefined) {
          data[pk] = insertedId;
        }
        return new DefinedModel(data, { isNewRecord: false });
      }

      static async bulkCreate(records, queryOpts = {}) {
        const results = [];
        for (const r of records) {
          results.push(await this.create(r, queryOpts));
        }
        return results;
      }

      static _buildWhereSql(where) {
        if (!where) return '';
        const clauses = [];
        const dialect = sequelize.options.dialect || 'sqlite';
        const isPostgres = dialect === 'postgres' || dialect === 'postgresql';

        function formatVal(v) {
          if (v === null || v === undefined) return 'NULL';
          if (v instanceof Date) return `'${v.toISOString()}'`;
          if (typeof v === 'string') return `'${v.replace(/'/g, "''")}'`;
          if (typeof v === 'boolean') return isPostgres ? (v ? 'TRUE' : 'FALSE') : (v ? '1' : '0');
          return v;
        }

        function buildCondition(key, val) {
          if (val === null) {
            return `${key} IS NULL`;
          } else if (typeof val === 'object' && val !== null && !(val instanceof Date)) {
            const syms = Object.getOwnPropertySymbols(val);
            if (syms.length > 0) {
              const sub = [];
              for (const sym of syms) {
                if (sym === Op.like) sub.push(`${key} LIKE '${String(val[sym]).replace(/'/g, "''")}'`);
                else if (sym === Op.in) {
                  const items = val[sym].map(v => formatVal(v)).join(', ');
                  sub.push(`${key} IN (${items})`);
                }
                else if (sym === Op.gt) sub.push(`${key} > ${formatVal(val[sym])}`);
                else if (sym === Op.lt) sub.push(`${key} < ${formatVal(val[sym])}`);
                else if (sym === Op.gte) sub.push(`${key} >= ${formatVal(val[sym])}`);
                else if (sym === Op.lte) sub.push(`${key} <= ${formatVal(val[sym])}`);
                else if (sym === Op.ne) sub.push(`${key} != ${formatVal(val[sym])}`);
                else if (sym === Op.eq) sub.push(`${key} = ${formatVal(val[sym])}`);
              }
              return sub.join(' AND ');
            }
          } else {
            return `${key} = ${formatVal(val)}`;
          }
          return '';
        }

        for (const [key, val] of Object.entries(where)) {
          const c = buildCondition(key, val);
          if (c) clauses.push(c);
        }

        for (const sym of Object.getOwnPropertySymbols(where)) {
          if (sym === Op.or && Array.isArray(where[sym])) {
            const orItems = [];
            for (const item of where[sym]) {
              const itemClauses = [];
              for (const [k, v] of Object.entries(item)) {
                const c = buildCondition(k, v);
                if (c) itemClauses.push(c);
              }
              if (itemClauses.length > 0) {
                orItems.push(`(${itemClauses.join(' AND ')})`);
              }
            }
            if (orItems.length > 0) {
              clauses.push(`(${orItems.join(' OR ')})`);
            }
          } else if (sym === Op.and && Array.isArray(where[sym])) {
            const andItems = [];
            for (const item of where[sym]) {
              const itemClauses = [];
              for (const [k, v] of Object.entries(item)) {
                const c = buildCondition(k, v);
                if (c) itemClauses.push(c);
              }
              if (itemClauses.length > 0) {
                andItems.push(`(${itemClauses.join(' AND ')})`);
              }
            }
            if (andItems.length > 0) {
              clauses.push(`(${andItems.join(' AND ')})`);
            }
          }
        }

        return clauses.length > 0 ? ` WHERE ${clauses.join(' AND ')}` : '';
      }

      static async findAll(queryOpts = {}) {
        let sql = `SELECT * FROM ${tableName}`;
        sql += this._buildWhereSql(queryOpts.where);

        if (queryOpts.order) {
          const orderParts = Array.isArray(queryOpts.order[0])
            ? queryOpts.order.map(([c, d]) => `${c} ${d}`).join(', ')
            : queryOpts.order.join(' ');
          sql += ` ORDER BY ${orderParts}`;
        }

        if (queryOpts.limit) {
          sql += ` LIMIT ${Number(queryOpts.limit)}`;
          if (queryOpts.offset) {
            sql += ` OFFSET ${Number(queryOpts.offset)}`;
          }
        }

        const txOpts = queryOpts && queryOpts.transaction ? { transaction: queryOpts.transaction } : {};
        const rows = await sequelize.query(sql, txOpts);
        const instances = rows.map(r => {
          // Parse JSON, BOOLEAN, and DATEONLY columns
          for (const [col, attr] of Object.entries(attributes)) {
            if (attr.type === DataTypes.JSON && typeof r[col] === 'string') {
              try { r[col] = JSON.parse(r[col]); } catch { }
            } else if (attr.type === DataTypes.BOOLEAN && r[col] !== null && r[col] !== undefined) {
              r[col] = Boolean(r[col]);
            } else if (attr.type === DataTypes.DATEONLY && r[col] instanceof Date) {
              const y = r[col].getFullYear();
              const m = String(r[col].getMonth() + 1).padStart(2, '0');
              const d = String(r[col].getDate()).padStart(2, '0');
              r[col] = `${y}-${m}-${d}`;
            }
          }
          return new DefinedModel(r, { isNewRecord: false });
        });

        if (queryOpts.include && Array.isArray(queryOpts.include)) {
          for (const inc of queryOpts.include) {
            const incModel = inc.model;
            const asName = inc.as || (incModel ? incModel.name : null);
            if (!incModel || !asName) continue;

            const assoc = this.associations && this.associations[asName];
            for (const instance of instances) {
              if (assoc && assoc.type === 'hasMany') {
                const fk = assoc.options.foreignKey || `${tableName.replace(/s$/, '')}_id`;
                const children = await incModel.findAll({
                  where: { [fk]: instance[this.primaryKeyAttribute] },
                  ...(inc.include ? { include: inc.include } : {}),
                  ...txOpts
                });
                const childData = children.map(c => (c.toJSON ? c.toJSON() : c));
                instance[asName] = childData;
                instance._values[asName] = childData;
                continue;
              }

              let related = null;
              const assocFk = assoc && assoc.options && assoc.options.foreignKey;
              const candidateFk = assocFk || `${asName}_id`;
              if (instance[candidateFk] !== undefined && instance[candidateFk] !== null) {
                related = await incModel.findByPk(instance[candidateFk], txOpts);
              } else if (instance.plant_catalog_id !== undefined && (incModel.tableName === 'plant_catalog' || asName === 'catalogPlant')) {
                related = await incModel.findByPk(instance.plant_catalog_id, txOpts);
              } else if (instance.owner_id !== undefined && (incModel.tableName === 'users' || asName === 'owner')) {
                related = await incModel.findByPk(instance.owner_id, txOpts);
              } else if (instance.user_id !== undefined && (incModel.name === 'User' || asName === 'user')) {
                related = await incModel.findByPk(instance.user_id, txOpts);
              } else if (instance.zone_id !== undefined && (incModel.name === 'Zone' || asName === 'zone')) {
                related = await incModel.findByPk(instance.zone_id, txOpts);
              } else if (instance.garden_id !== undefined && (incModel.name === 'Garden' || asName === 'garden')) {
                related = await incModel.findByPk(instance.garden_id, txOpts);
              }

              if (related) {
                let relatedData = related.toJSON ? related.toJSON() : related;
                if (inc.attributes && Array.isArray(inc.attributes)) {
                  const filtered = {};
                  for (const attr of inc.attributes) {
                    filtered[attr] = relatedData[attr];
                  }
                  relatedData = filtered;
                }
                instance[asName] = relatedData;
                instance._values[asName] = relatedData;
              } else {
                instance[asName] = null;
                instance._values[asName] = null;
              }
            }
          }
        }

        return instances;
      }

      static async findAndCountAll(queryOpts = {}) {
        const txOpts = queryOpts && queryOpts.transaction ? { transaction: queryOpts.transaction } : {};
        const count = await this.count({ where: queryOpts.where, ...txOpts });
        const rows = await this.findAll(queryOpts);
        return { count, rows };
      }

      static async findOne(queryOpts = {}) {
        const all = await this.findAll({ ...queryOpts, limit: 1 });
        return all[0] || null;
      }

      static async findByPk(id, queryOpts = {}) {
        const pk = this.primaryKeyAttribute;
        return await this.findOne({ ...queryOpts, where: { [pk]: id } });
      }

      static async update(values, queryOpts = {}) {
        const setClauses = [];
        const dialect = sequelize.options.dialect || 'sqlite';
        const isPostgres = dialect === 'postgres' || dialect === 'postgresql';
        const isMaria = dialect === 'mariadb' || dialect === 'mysql';
        const now = isMaria ? new Date().toISOString().slice(0, 19).replace('T', ' ') : new Date().toISOString();
        const data = { ...values };
        const hasTimestamps = options.timestamps !== false && (options.timestamps || (sequelize.options.define && sequelize.options.define.timestamps));
        const isUnderscored = options.underscored || (sequelize.options.define && sequelize.options.define.underscored);
        const updatedAtField = isUnderscored ? 'updated_at' : 'updatedAt';
        if (hasTimestamps && options.updatedAt !== false && !data[updatedAtField]) data[updatedAtField] = now;
        if (attributes.updated_at && !data.updated_at) data.updated_at = now;
        if (attributes.updatedAt && !data.updatedAt) data.updatedAt = now;

        for (const [col, val] of Object.entries(data)) {
          if (this.associations && col in this.associations) continue;
          if (val === null || val === undefined) {
            setClauses.push(`${col} = NULL`);
          } else if (val instanceof Date) {
            setClauses.push(isMaria ? `${col} = '${val.toISOString().slice(0, 19).replace('T', ' ')}'` : `${col} = '${val.toISOString()}'`);
          } else if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(val)) {
            setClauses.push(isMaria ? `${col} = '${val.slice(0, 19).replace('T', ' ')}'` : `${col} = '${val}'`);
          } else if (typeof val === 'object') {
            setClauses.push(`${col} = '${JSON.stringify(val).replace(/'/g, "''")}'`);
          } else if (typeof val === 'string') {
            setClauses.push(`${col} = '${val.replace(/'/g, "''")}'`);
          } else if (typeof val === 'boolean') {
            setClauses.push(`${col} = ${isPostgres ? (val ? 'TRUE' : 'FALSE') : (val ? 1 : 0)}`);
          } else {
            setClauses.push(`${col} = ${val}`);
          }
        }

        let sql = `UPDATE ${tableName} SET ${setClauses.join(', ')}`;
        sql += this._buildWhereSql(queryOpts.where);
        const res = await sequelize.query(sql, queryOpts && queryOpts.transaction ? { transaction: queryOpts.transaction } : {});
        const changes = res && res.changes !== undefined
          ? res.changes
          : (res && res.affectedRows !== undefined ? Number(res.affectedRows) : 0);
        return [changes];
      }

      static async destroy(queryOpts = {}) {
        let sql = `DELETE FROM ${tableName}`;
        sql += this._buildWhereSql(queryOpts.where);
        const res = await sequelize.query(sql, queryOpts && queryOpts.transaction ? { transaction: queryOpts.transaction } : {});
        const changes = res && res.changes !== undefined
          ? res.changes
          : (res && res.affectedRows !== undefined ? Number(res.affectedRows) : 0);
        return changes;
      }

      static async count(queryOpts = {}) {
        let sql = `SELECT COUNT(*) AS cnt FROM ${tableName}`;
        sql += this._buildWhereSql(queryOpts.where);
        const rows = await sequelize.query(sql, queryOpts && queryOpts.transaction ? { transaction: queryOpts.transaction } : {});
        return rows[0] ? Number(rows[0].cnt || rows[0].CNT || rows[0].count || rows[0]['COUNT(*)'] || 0) : 0;
      }

      static hasMany(target, opts = {}) {
        this.associations = this.associations || {};
        const asKey = opts.as || (target.name ? target.name.toLowerCase() + 's' : 'hasMany');
        this.associations[asKey] = { target, options: opts, type: 'hasMany' };
      }
      static belongsTo(target, opts = {}) {
        this.associations = this.associations || {};
        const asKey = opts.as || (target.name ? target.name.toLowerCase() : 'belongsTo');
        this.associations[asKey] = { target, options: opts, type: 'belongsTo' };
      }
      static hasOne(target, opts = {}) {
        this.associations = this.associations || {};
        const asKey = opts.as || (target.name ? target.name.toLowerCase() : 'hasOne');
        this.associations[asKey] = { target, options: opts, type: 'hasOne' };
      }
      static belongsToMany(target, opts = {}) {
        this.associations = this.associations || {};
        const asKey = opts.as || (target.name ? target.name.toLowerCase() + 's' : 'belongsToMany');
        this.associations[asKey] = { target, options: opts, type: 'belongsToMany' };
      }
    }

    this.models[modelName] = DefinedModel;
    return DefinedModel;
  }

  async sync(options = {}) {
    for (const [name, model] of Object.entries(this.models)) {
      await model.sync(options);
    }
  }

  async transaction(optionsOrFn, maybeFn) {
    const fn = typeof optionsOrFn === 'function' ? optionsOrFn : maybeFn;
    if (this.options.dialect === 'sqlite') {
      if (typeof fn === 'function') {
        await this.query('BEGIN TRANSACTION;');
        try {
          const res = await fn({ sequelize: this });
          await this.query('COMMIT;');
          return res;
        } catch (err) {
          try {
            await this.query('ROLLBACK;');
          } catch {
            // ignore rollback error so original error propagates
          }
          throw err;
        }
      }
      await this.query('BEGIN TRANSACTION;');
      return {
        sequelize: this,
        commit: async () => await this.query('COMMIT;'),
        rollback: async () => await this.query('ROLLBACK;')
      };
    }

    if (this.options.dialect === 'postgres' || this.options.dialect === 'postgresql') {
      const pool = this._getPgPool();
      const client = await pool.connect();
      const t = {
        sequelize: this,
        _client: client,
        _connection: client,
        _finished: false,
        commit: async () => {
          if (t._finished) return;
          try {
            await client.query('COMMIT;');
          } finally {
            t._finished = true;
            t._client = null;
            t._connection = null;
            client.release();
          }
        },
        rollback: async () => {
          if (t._finished) return;
          try {
            await client.query('ROLLBACK;');
          } finally {
            t._finished = true;
            t._client = null;
            t._connection = null;
            client.release();
          }
        }
      };

      try {
        await client.query('BEGIN;');
      } catch (err) {
        t._finished = true;
        client.release();
        throw err;
      }

      if (typeof fn === 'function') {
        try {
          const res = await fn(t);
          await t.commit();
          return res;
        } catch (err) {
          await t.rollback().catch(() => {});
          throw err;
        }
      }
      return t;
    }

    // MariaDB dialect: acquire a dedicated pooled connection for the transaction
    const pool = this._getMariaPool();
    const conn = await pool.getConnection();
    const t = {
      sequelize: this,
      _connection: conn,
      _finished: false,
      commit: async () => {
        if (t._finished) return;
        try {
          await this.query('COMMIT;', { transaction: t });
        } finally {
          t._finished = true;
          t._connection = null;
          await conn.release();
        }
      },
      rollback: async () => {
        if (t._finished) return;
        try {
          await this.query('ROLLBACK;', { transaction: t });
        } finally {
          t._finished = true;
          t._connection = null;
          await conn.release();
        }
      }
    };

    try {
      await this.query('START TRANSACTION;', { transaction: t });
    } catch (err) {
      t._finished = true;
      t._connection = null;
      await conn.release().catch(() => {});
      throw err;
    }

    if (typeof fn === 'function') {
      try {
        const res = await fn(t);
        await t.commit();
        return res;
      } catch (err) {
        try {
          await t.rollback();
        } catch {
          // ignore rollback error so original error propagates
        }
        throw err;
      }
    }

    return t;
  }
}

Sequelize.DataTypes = DataTypes;
Sequelize.Op = Op;
Sequelize.Model = Model;

module.exports = {
  Sequelize,
  DataTypes,
  Op,
  Model
};
