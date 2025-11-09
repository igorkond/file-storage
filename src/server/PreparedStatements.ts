'use strict';
import {DatabaseSync} from 'node:sqlite';

export default class PreparedStatements {
	_createFolder;
	_upsertFile;
	_createFileType;
	_downloadFile;
	_renameFolder;
	_renameFile;
	_deleteFolder;
	_deleteFile;
	_getFileContent;
	_getFileDescription;
	_getFileName;
	_getFilesAndFolders;
	
	constructor(database: InstanceType<typeof DatabaseSync>){
		this._createFolder = database.prepare(`INSERT INTO
		Папки (Название, КодРодительскойПапки)
		VALUES (:folderName, :parentFolderId)
		ON CONFLICT (Название, КодРодительскойПапки)
		DO UPDATE SET КодПапки = КодПапки RETURNING КодПапки`);
		this._upsertFile = database.prepare(`INSERT INTO
		Файлы (Название, Описание, КодТипаФайла, КодПапки, Контент)
		VALUES (:fileName, :fileDescription, :fileTypeId, :folderId, :fileContent)
		ON CONFLICT (Название, КодПапки)
		DO UPDATE SET Описание = :fileDescription, КодТипаФайла = :fileTypeId, Контент = :fileContent`);
		this._createFileType = database.prepare(`INSERT INTO
		"Расширения файлов" (Тип, Иконка)
		VALUES (:fileType, :fileTypeIcon)
		ON CONFLICT (Тип)
		DO UPDATE SET Иконка = :fileTypeIcon RETURNING КодТипаФайла`);
		this._downloadFile = database.prepare('SELECT Название AS name, Контент AS content FROM Файлы WHERE КодФайла = :fileId');
		this._renameFolder = database.prepare('UPDATE Папки SET Название = :newName WHERE КодПапки = :id');
		this._renameFile = database.prepare('UPDATE Файлы SET Название = :newName WHERE КодФайла = :id');
		this._deleteFolder = database.prepare('DELETE FROM Папки WHERE КодПапки = :folderId');
		this._deleteFile = database.prepare('DELETE FROM Файлы WHERE КодФайла = :fileId');
		this._getFileContent = database.prepare('SELECT Контент AS content FROM Файлы WHERE КодФайла = :fileId');
		this._getFileDescription = database.prepare('SELECT Описание AS description FROM Файлы WHERE КодФайла = :fileId');
		this._getFileName = database.prepare('SELECT Название AS name FROM Файлы WHERE КодФайла = :fileId');
		this._getFilesAndFolders = database.prepare(`
		SELECT 'folder' AS type, КодПапки AS id, Название AS name, КодРодительскойПапки AS parentFolderId, '' AS fileType, '📁' AS fileTypeIcon FROM Папки
		UNION ALL
		SELECT 'file' AS type, КодФайла AS id, Название AS name, КодПапки AS parentFolderId, Тип AS fileType, Иконка AS fileTypeIcon FROM Файлы
		LEFT JOIN "Расширения файлов"
		ON Файлы.КодТипаФайла = "Расширения файлов".КодТипаФайла`);
	}
	createFolder(folderName: string, parentFolderId: number | null): number {
		const folderId = this._createFolder.get({folderName,parentFolderId})!.КодПапки;
		if(typeof folderId !== 'number'){
			throw new Error(`Эта ошибка никогда не должна произойти: КодПапки должен быть числом, а не ${typeof folderId}`);
		}
		return folderId;
	}
	deleteFolder(folderId: number){
		return this._deleteFolder.run({folderId});
	}
	uploadFile(fileName: string, fileDescription: string, folderId: number, fileContent: string){
		try{
			let fileType = fileName.split('.').at(-1) ?? '';
			if(fileType === fileName){
				fileType = '';
			}
			let fileTypeId = this._createFileType.get({fileType, fileTypeIcon: '📄'})!.КодТипаФайла;
			if(typeof fileTypeId !== 'number'){
				throw new Error(`Эта ошибка никогда не должна произойти: КодТипаФайла должен быть числом, а не ${typeof fileTypeId}`);
			}
			return this._upsertFile.run({fileName,fileDescription,fileTypeId,folderId,fileContent});
		}catch(e){
			return {error: String(e)};
		}
	}
	downloadFile(fileId: number){
		return this._downloadFile.get({fileId});
	}
	deleteFile(fileId: number){
		return this._deleteFile.run({fileId});
	}
	renameFile(id: number, newName: string){
		try{
			return this._renameFile.run({id,newName});
		}catch(e){
			return {error: `Файл не был переименован, потому что другой файл с тем же именем (${newName}) уже существует в той же папке`};
		}
	}
	renameFolder(id: number, newName: string){
		try{
			return this._renameFolder.run({id,newName});
		}catch(e){
			return {error: `Папка не была переименована, потому что другая папка с тем же именем (${newName}) уже существует в той же папке`};
		}
	}
	getFileContent(fileId: number){
		return this._getFileContent.get({fileId});
	}
	getFileDescription(fileId: number){
		return this._getFileDescription.get({fileId});
	}
	getFileName(fileId: number){
		return this._getFileName.get({fileId});
	}
	getFilesAndFolders(){
		return this._getFilesAndFolders.all();
	}
};