import { ReactNode } from "react";
import { antdColumn, ColumnsType } from "../fields";
import { webapp_client } from "@cocalc/frontend/webapp-client";

import "./tasks";
import "./people";
import "./leads";
import "./organizations";
import "./tags";
import "./support-tickets";
import "./support-messages";

import "./site-licenses";
import "./accounts";
import "./agents";
import "./patches";
import "./projects";
import "./public-paths";
import "./shopping-cart-items";
import "./syncstrings";

interface TableDescription {
  name: string;
  title: ReactNode;
  icon?: string; // todo: render this..
  query: object;
  columns: ColumnsType[];
  allowCreate?: boolean;
  changes?: boolean;
  timeKey?: string;
  createDefaults?: object;
  updateDefaults?: object;
  __templates?: boolean; // set after we fill in any templates.
}

let tables: { [name: string]: TableDescription };

export function register(desc: Partial<TableDescription>) {
  if (tables == null) {
    tables = {};
  }
  if (desc.columns == null) {
    desc.columns = [];
  }
  const known = new Set<string>();
  for (const c of desc.columns) {
    if (c.dataIndex) {
      known.add(c.dataIndex);
    }
  }
  if (desc.title == null) {
    throw Error("title must be specified");
  }
  if (desc.name == null) {
    throw Error("name must be specified");
  }
  if (desc.query == null) {
    throw Error("query must be specified");
  }
  const table = Object.keys(desc.query)[0];
  for (const field in desc.query[table][0]) {
    if (!known.has(field)) {
      desc.columns.push(antdColumn(table, field));
    }
  }
  if (desc.columns[0] != null) {
    desc.columns[0].fixed = "left";
  }
  tables[desc.name] = desc as TableDescription;
}

export function getTableDescription(name: string): TableDescription {
  const desc = tables[name];
  if (desc == null) {
    throw Error(`unknown table ${name}`);
  }
  fillInTemplates(desc);
  return desc;
}

export function getDBTableDescription(dbtable: string): TableDescription {
  for (const name in tables) {
    if (dbtable == Object.keys(tables[name].query)[0]) {
      return getTableDescription(name);
    }
  }
  throw Error(`unknown dbtable ${dbtable}`);
}

export function getTables(): string[] {
  return Object.keys(tables ?? {});
}

function fillInTemplates(desc) {
  if (desc.__templates) return;
  for (const field of ["createDefaults", "updateDefaults"]) {
    const x = desc[field];
    if (x != null) {
      for (const key in x) {
        if (x[key] == "[account_id]") {
          x[key] = webapp_client.account_id;
        }
      }
    }
  }
  desc.__templates = true;
}
