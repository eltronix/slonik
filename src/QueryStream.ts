/* eslint-disable @typescript-eslint/ban-types */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable fp/no-class */
/* eslint-disable fp/no-this */
/* eslint-disable id-match */
/* eslint-disable promise/prefer-await-to-callbacks */

import {
  Readable,
} from 'stream';
import {
  QueryResult,
} from 'pg';
import Cursor from 'pg-cursor';

// import Result from 'pg/lib/result';

/**
 * @see https://github.com/brianc/node-pg-query-stream
 * @see https://github.com/brianc/node-pg-query-stream/issues/51
 */
export class QueryStream extends Readable {
  _reading: boolean;

  _closed: boolean;

  // _result: Result;
  // cursor: Cursor;

  _result: any;

  cursor: any;

  batchSize: number;

  handleRowDescription: Function;

  handlePortalSuspended: Function;

  handleDataRow: Function;

  handleCommandComplete: Function;

  handleReadyForQuery: Function;

  handleError: Function;

  // @ts-expect-error
  constructor (text, values, options?) {
    super({
      objectMode: true,
      ...options,
    });
    this.cursor = new Cursor(text, values);
    this._reading = false;
    this._closed = false;
    this.batchSize = (options || {}).batchSize || 100;

    // delegate Submittable callbacks to cursor
    this.handleRowDescription = this.cursor.handleRowDescription.bind(this.cursor);
    this.handleDataRow = this.cursor.handleDataRow.bind(this.cursor);
    this.handlePortalSuspended = this.cursor.handlePortalSuspended.bind(this.cursor);
    this.handleCommandComplete = this.cursor.handleCommandComplete.bind(this.cursor);
    this.handleReadyForQuery = this.cursor.handleReadyForQuery.bind(this.cursor);
    this.handleError = this.cursor.handleError.bind(this.cursor);

    // pg client sets types via _result property
    this._result = this.cursor._result;
  }

  submit (connection: Object) {
    this.cursor.submit(connection);
  }

  close (callback: Function) {
    this._closed = true;

    // eslint-disable-next-line unicorn/consistent-function-scoping
    const close = () => {
      this.emit('close');
    };

    this.cursor.close(callback || close);
  }

  _read (size: number) {
    if (this._reading || this._closed) {
      return;
    }
    this._reading = true;
    const readAmount = Math.max(size, this.batchSize);
    this.cursor.read(readAmount, (error: Error, rows: unknown[], result: QueryResult) => {
      if (this._closed) {
        return;
      }

      if (error) {
        this.emit('error', error);

        return;
      }

      if (!rows.length) {
        this._closed = true;

        setImmediate(() => {
          this.emit('close');
        });

        this.push(null);

        return;
      }

      // push each row into the stream
      this._reading = false;

      for (const row of rows) {
        this.push({
          fields: (result.fields || []).map((field) => {
            return {
              dataTypeId: field.dataTypeID,
              name: field.name,
            };
          }),
          row,
        });
      }
    });
  }
}
