import * as z from 'zod';
import { Expr, query as q } from 'faunadb';

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

  query(modelName:string, fieldName: string):Expr {
    return q.Select(['data', fieldName], q.Var('document'));
  }

  deconstruct(modelName: string, fieldName: string): Expr[] {
    return [];
  };

  construct(modelName: string, fieldName: string): {tables?: Expr[], indexes?: Expr[]} {
    return {};
  };
}