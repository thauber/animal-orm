import * as z from 'zod';
import { Expr, query as q } from 'faunadb';

export interface FieldOptions {
  hidden?: boolean;
  coerce?: boolean;
  singular?: string;
}

export class Field<A extends z.ZodType, E extends z.ZodType = A > {
  readonly admit: A;
  readonly emit: E;
  readonly _hidden: boolean;
  readonly _tertiary: boolean;
  readonly singular: string;
  readonly options: FieldOptions;

  constructor(schema: A | E | [A,E], options: FieldOptions = {}) {
    this._tertiary = false;
    this._hidden = options.hidden || false;
    this.emit = Array.isArray(schema) ? schema[1] : schema as E; 
    this.admit = Array.isArray(schema) ? schema[0] : schema as A;
    this.singular = options.singular || '';
    this.options = options;
  }

  query(_modelName:string, fieldName: string):Expr {
    const path = ['data', fieldName]
    return q.Select(path, q.Var('document'), null);
  }

  deconstruct(modelName: string, fieldName: string): Expr[] {
    return [];
  };

  index(modelName:string, fieldName:string): Expr[] {
    return [];
  }

  construct(modelName: string, fieldName: string): Expr[] {
    return [];
  };
}