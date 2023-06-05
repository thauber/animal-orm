import * as z from 'zod';
import { query as q } from 'faunadb';
import { ParseOptions } from './Model';

export interface FieldOptions {
  hidden?: boolean;
  coerce?: boolean;
  singular?: string;
}

export interface IndexedFieldOptions extends FieldOptions {
  sort?: string[];
  reverse?: string;
}

export interface IndexValue {
  field: string[],
  reverse?: boolean,
}

export class Field {
  readonly _schema: z.ZodType<any,any>;
  readonly singular: string;
  readonly options: FieldOptions;

  constructor(schema: z.ZodType<any,any>, options: FieldOptions = {}) {
    this._schema = schema;
    this.singular = options.singular || '';
    this.options = options;
  }

  schema(options:ParseOptions = {}) {
    return this._schema
  }

  query(modelName:string, fieldName: string) {
    return q.Select(['data', fieldName], q.Var('document'));
  }

  construct(modelName: string, fieldName: string): any[] {
    return []
  };
}