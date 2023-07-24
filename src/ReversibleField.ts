import { z } from "zod";
import { Field, FieldOptions } from "./Field";
import { type Model, type ModelFieldSet } from "./Model";

export type ReverseName = string | undefined

export interface ReversibleFieldOptions extends FieldOptions {
  reverseIndexName?: string
  reverse?: string;
}

export default class ReversibleField<A extends z.ZodTypeAny, E extends z.ZodTypeAny, M extends ModelFieldSet> extends Field<A, E> {
  readonly options: ReversibleFieldOptions
  readonly model: Model<M>;

  constructor(model: Model<M>, schema: A | E | [A,E], options: ReversibleFieldOptions = {}) {
    super(schema, options);
    this.options = options;
    this.model = model;
  }

  getReverseIndexName(fieldName: string): string {
    if (typeof this.options.reverse === 'string') {
      return (this.options.reverseIndexName || `${this.options.reverse}_by_${fieldName}`)
    }
    throw(new Error(`Field ${fieldName} does not have a reverse`))
  }
}