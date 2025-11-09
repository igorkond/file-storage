'use strict';
import {dirname, join} from 'node:path';
import {existsSync, unlinkSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import PreparedStatements from './PreparedStatements.js';
import {fileURLToPath} from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const path = join(dirname(dirname(__dirname)), 'sqlite.db');

if(existsSync(path)){
	unlinkSync(path);
}

const database = new DatabaseSync(path);
database.exec(`
  CREATE TABLE Папки (
	КодПапки INTEGER PRIMARY KEY,
	Название TEXT,
	КодРодительскойПапки INTEGER,
	FOREIGN KEY (КодРодительскойПапки) REFERENCES Папки (КодПапки) ON DELETE CASCADE,
	UNIQUE (Название, КодРодительскойПапки),
	CHECK (КодРодительскойПапки <> КодПапки)
  ) STRICT
`);
database.exec(`
  CREATE TABLE Файлы (
	КодФайла INTEGER PRIMARY KEY,
	Название TEXT,
	Описание TEXT,
	КодТипаФайла INTEGER,
	КодПапки INTEGER,
	Контент TEXT,
	FOREIGN KEY (КодТипаФайла) REFERENCES "Расширения файлов" (КодТипаФайла),
	FOREIGN KEY (КодПапки) REFERENCES Папки (КодПапки) ON DELETE CASCADE,
	UNIQUE (Название, КодПапки)
  ) STRICT
`);
database.exec(`
  CREATE TABLE "Расширения файлов" (
	КодТипаФайла INTEGER PRIMARY KEY,
	Тип TEXT NOT NULL UNIQUE,
	Иконка TEXT
  ) STRICT
`);

export default new PreparedStatements(database);