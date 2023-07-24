import * as z from 'zod';
import { Expr, query as q } from 'faunadb';
import { sortToValues } from './utils';

export interface IndexValue {
  field: string[],
  reverse?: boolean,
}

export interface FieldOptions {
  singular?: string;
  unique?: boolean;
  indexed?: boolean | string[];
}

export class Field<A extends z.ZodType<any>, E extends z.ZodType<any> = A > {
  readonly admit: A;
  readonly emit: E;
  readonly singular: string;
  readonly options: FieldOptions;

  constructor(schema: A | E | [A,E], options: FieldOptions = {}) {
    this.emit = Array.isArray(schema) ? schema[1] : schema as E; 
    this.admit = Array.isArray(schema) ? schema[0] : schema as A;
    this.singular = options.singular || '';
    this.options = options;
  }

  getIndexName(modelName: string, fieldName: string) {
    return `${modelName}_by_${fieldName}`
  }

  path(fieldName: string): string[] | null {
    return ['data', fieldName];
  }

  query(_modelName:string, fieldName: string):Expr {
    const path = this.path(fieldName)
    if (path === null) throw(new Error(`Fields without paths must override query`))
    return q.Select(path, q.Var('document'), null);
  }

  deconstruct(modelName: string, fieldName: string): Expr[] {
    return [];
  };

  index(modelName:string, fieldName:string): Expr[] {
    if (this.options.indexed || this.options.unique) {
      let sort = ['-ts']
      if (this.options.indexed && this.options.indexed !== true) {
        sort = this.options.indexed
      }
      return [
        q.CreateIndex({
          name: this.getIndexName(modelName, fieldName),
          source: q.Collection(modelName),
          terms: [{ field: ['data', fieldName] }],
          unique: !!this.options.unique,
          values: sortToValues(sort).concat([{field: ['ref']}]),
        })
      ]
    }
    return []
  }

  construct(modelName: string, fieldName: string): Expr[] {
    return [];
  };
}