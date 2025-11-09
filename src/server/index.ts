'use strict';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {Readable} from 'node:stream';
import http from 'node:http';
import fsp from 'node:fs/promises';
import ps from './create-tables-and-return-prepared-statements.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const ipAddress = '127.0.0.1';
const port = 8080;
const baseUrl = `http://${ipAddress}:${port}`;

const rootFolderId = ps.createFolder('Проект_1',null);
const binFolderId = ps.createFolder('bin',rootFolderId);
const resourcesFolderId = ps.createFolder('Resources',rootFolderId);
const debugFolderId = ps.createFolder('Debug',binFolderId);

ps.uploadFile('App.xaml', 'Файл, в котором объявляются ресурсы', rootFolderId, ('Контент App.xaml '.repeat(10)+'\n').repeat(30));
ps.uploadFile('MainWindow.xaml', 'Файл, в котором определяется интерфейс для главного окна приложения', rootFolderId, ('Контент MainWindow.xaml '.repeat(5)+'\n').repeat(20));
ps.uploadFile('MainWindow.cs', 'Логика взаимодействия для MainWindow.xaml', rootFolderId, ('Контент MainWindow.cs '.repeat(5)+'\n').repeat(40));

function normalizePathname(pathname: string){
	const parts = pathname.split('/').filter(Boolean);
	const trailingPart = parts.pop()!;
	let id = Number(trailingPart);
	if(Number.isNaN(id)){
		parts.push(trailingPart);
	}
	return {pathnameWithoutId: '/'+parts.join('/'), id};
}

const server = http.createServer(async function(request: InstanceType<typeof http.IncomingMessage>, response: InstanceType<typeof http.ServerResponse>){
	response.setHeader('Cache-Control', 'no-store');
	if(!request.url || !request.method){
		response.writeHead(400, { 'Content-Type': 'text/plain' });
		response.end('И url, и method запроса должны быть строками');
		return;
	}
	const {href, pathname, searchParams} = new URL(request.url, baseUrl);
	const method = request.method.toLowerCase();
	const {pathnameWithoutId, id} = normalizePathname(pathname);
	if(pathnameWithoutId === '/api/entities/files' && method === 'post') {
		const webHeaders: Record<string, string> = {};
		for(const key of Object.keys(request.headers)){
			const value = request.headers[key];
			if(Array.isArray(value)){
				webHeaders[key] = value.join(', ');
			}else if(value){
				webHeaders[key] = value;
			}
		}
		const webRequest = new Request(href, {
			method,
			headers: webHeaders,
			body: Readable.toWeb(request),
			duplex: 'half'
		});
		const formData = await webRequest.formData();
		const description = String(formData.get('description'));
		const folderId = Number(formData.get('folderId'));
		const file = formData.get('file');
		if(!(file instanceof File)){
			throw new Error('file is expected to be an instance of File');
		}
		try{
			const fileContent = await file.text();
			ps.uploadFile(file.name, description, folderId, fileContent);
			response.writeHead(204, {'Content-Type': 'text/plain'});
			response.end();
		}catch(e: unknown){
			response.writeHead(400, {'Content-Type': 'text/plain'});
			response.end(String(e));
		}
		
	}else if(pathnameWithoutId === '/api/entities' && method === 'get'){
		const body = JSON.stringify(ps.getFilesAndFolders());
		response.writeHead(200, {'Content-Type': 'application/json'});
		response.end(body);
		
	}else if(pathnameWithoutId === '/api/entities/folders' && method === 'post'){
		const folderName = searchParams.get('name');
		if(folderName && folderName.trim()){
			const parentFolderId = Number(searchParams.get('parentId'));
			const body = JSON.stringify(ps.createFolder(folderName, parentFolderId || null));
			response.writeHead(200, {'Content-Type': 'application/json'});
			response.end(body);
		}else{
			const body = JSON.stringify({error: 'Было введено пустое название папки, это не разрешено, поэтому папка не была создана'});
			response.writeHead(400, {'Content-Type': 'application/json'});
			response.end(body);
		}
		
	}else if(pathnameWithoutId === '/api/entities/folders' && method === 'delete'){
		ps.deleteFolder(id);
		response.writeHead(204, {'Content-Type': 'text/plain'});
		response.end();
		
	}else if(pathnameWithoutId === '/api/entities/folders' && method === 'patch'){
		const newName = searchParams.get('name');
		if(newName && newName.trim()){
			const body = JSON.stringify(ps.renameFolder(id, newName));
			response.writeHead(200, {'Content-Type': 'application/json'});
			response.end(body);
		}else{
			const body = JSON.stringify({error: 'Было введено пустое название папки, это не разрешено, поэтому папка не была переименована'});
			response.writeHead(400, {'Content-Type': 'application/json'});
			response.end(body);
		}
		
	}else if(pathnameWithoutId === '/api/entities/files' && method === 'patch'){
		const newName = searchParams.get('name');
		if(newName && newName.trim()){
			const body = JSON.stringify(ps.renameFile(id, newName));
			response.writeHead(200, {'Content-Type': 'application/json'});
			response.end(body);
		}else{
			const body = JSON.stringify({error: 'Было введено пустое название файла, это не разрешено, поэтому файл не был переименован'});
			response.writeHead(400, {'Content-Type': 'application/json'});
			response.end(body);
		}
		
	}else if(pathnameWithoutId === '/api/entities/files' && method === 'delete'){
		ps.deleteFile(id);
		response.writeHead(204, {'Content-Type': 'text/plain'});
		response.end();
		
	}else if(pathnameWithoutId === '/api/entities/files' && method === 'get'){
		const file = ps.downloadFile(id)!;
		response.writeHead(200, {'Content-Type': 'text/plain', 'Content-Disposition': `attachment; filename="${file.name}"`});
		response.end(file.content);
		
	}else if(pathnameWithoutId === '/api/entities/files/descriptions' && method === 'get'){
		const body = JSON.stringify(ps.getFileDescription(id));
		response.writeHead(200, {'Content-Type': 'application/json'});
		response.end(body);
		
	}else if(pathnameWithoutId === '/api/entities/files/contents' && method === 'get'){
		const body = JSON.stringify(ps.getFileContent(id));
		response.writeHead(200, {'Content-Type': 'application/json'});
		response.end(body);
		
	}else if(pathnameWithoutId === '/' && method === 'get'){
		const body = await fsp.readFile(join(dirname(dirname(__dirname)),'public','index.html'));
		response.writeHead(200, {'Content-Type': 'text/html'});
		response.end(body);
		
	}else if(pathnameWithoutId === '/script.js' && method === 'get'){
		const body = await fsp.readFile(join(dirname(__dirname),'client','script.js'));
		response.writeHead(200, {'Content-Type': 'text/javascript'});
		response.end(body);
		
	}else if(pathnameWithoutId === '/styles.css' && method === 'get'){
		const body = await fsp.readFile(join(dirname(dirname(__dirname)),'public','styles.css'));
		response.writeHead(200, {'Content-Type': 'text/css'});
		response.end(body);
		
	}else if(pathnameWithoutId === '/favicon.ico' && method === 'get'){
		const body = await fsp.readFile(join(dirname(dirname(__dirname)),'public','favicon.ico'));
		response.writeHead(200, {'Content-Type': 'image/x-icon'});
		response.end(body);
		
	}else{
		response.writeHead(404, {'Content-Type': 'application/json'});
		response.end(JSON.stringify({error: 'Not found'}));
	}
});

server.listen(port, ipAddress, () => {
	console.log('Server listening...');
});