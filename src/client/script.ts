'use strict';

interface Entity {
	type: 'folder' | 'file';
	id: number;
	name: string;
	parentFolderId: number | null;
	//fileTypeId: string;
	fileType: string;
	fileTypeIcon: string;
}
class Card {
	type: string;
	id: string;
	name: string;
	parentFolderId: string;
	description: string;
	tabElement: HTMLElement;
	contentElement: HTMLElement;
	tabs: HTMLElement;
	main: HTMLElement;
	
	constructor(entityType: string = '', id: string = '', name: string = '', parentFolderId: string = '', description: string = '', content: string = '') {
		this.type = entityType;
		this.id = id;
		this.name = name;
		this.parentFolderId = parentFolderId;
		this.description = description;
		this.tabElement = this.renderTab(name);
		this.contentElement = this.renderContent(content);
		this.tabs = document.getElementById('tabs')!;
		this.main = document.getElementById('main')!;
		this.hide();
	}
	activate(): void {
		this.contentElement.hidden = false;
		if(state.currentlyActiveFileCard !== this){
			state.currentlyActiveFileCard.deactivate();
			state.currentlyActiveFileCard = this;
		}
		this.tabElement.firstElementChild!.classList.add('active-tab');
	}
	deactivate(): void {
		this.contentElement.hidden = true;
		this.tabElement.firstElementChild!.classList.remove('active-tab');
	}
	show(): void {
		this.tabElement.hidden = false;
		this.activate();
		this.makeTabRightmost();
	}
	hide(): void {
		this.tabElement.hidden = true;
		this.deactivate();
	}
	isHidden(){
		return this.tabElement.hidden;
	}
	makeTabRightmost(): void {
		this.tabs.appendChild(this.tabElement);
	}
	makeContentTopmost(): void {
		this.main.appendChild(this.contentElement);
	}
	renderContent(content: string): HTMLElement {
		const pre = document.createElement('pre');
		const article = document.createElement('article');
		article.textContent = content;
		pre.appendChild(article);
		return pre;
	}
	renderTab(name: string): HTMLElement {
		const li = document.createElement('li');
		const div = document.createElement('div');
		div.classList.add('tab');
		div.textContent = name;
		const currentCard = this;
		div.addEventListener('click', async function(event: Event) {
			if(div.classList.contains('active-tab')){
				currentCard.hide();
				state.currentlyActiveFileCard = dummyCard;
			}else{
				currentCard.activate();
				state.isLastActivatedEntityOfTypeFolder = false;
				state.currentlyActiveFolderCard = dummyCard;
			}
		});
		li.appendChild(div);
		return li;
	}
}

const dummyCard = new Card();
const state = {
	currentlyActiveFolderCard: dummyCard,
	currentlyActiveFileCard: dummyCard,
	isLastActivatedEntityOfTypeFolder: true,
	cards: new Map<string, Card>()
};
let activeTooltipTimer: number;

document.addEventListener('DOMContentLoaded',async function(){
	await updateState();
	
	document.getElementById('createFolder')!.addEventListener('click', async function(){
		const parentFolderId = state.currentlyActiveFolderCard.id;
		if(!parentFolderId){
			if(!confirm('Чтобы создать папку, выберите нажатием мыши папку, в которой вы хотите её создать, а затем нажмите "Создать Папку".\n\nВы не выбрали папку, в которой вы хотите создать новую папку, поэтому, если продолжить, новая папка будет создана в корне дерева папок и файлов.\n\nПродолжить?')){
				return;
			}
		}
		const parentName = state.currentlyActiveFolderCard.name;
		const name = prompt(`Введите название новой папки, которую вы пытаетесь создать в ${parentFolderId ? "папке " + parentName : "корне дерева папок и файлов"}:`);
		if(name === null){
			return;
		}
		if(name.trim() === ''){
			confirm('Было введено пустое название папки, это не разрешено, поэтому папка не была создана');
			return;
		}
		let url = `http://127.0.0.1:8080/api/entities/folders?name=${name}`;
		if(parentFolderId){
			url = url+'&parentId='+parentFolderId;
		}
		const folderId = await (await fetch(url, {method: 'POST'})).text();
		await updateState();
	});
	document.getElementById('deleteFolder')!.addEventListener('click', async function(){
		const id = state.currentlyActiveFolderCard.id;
		if(!id){
			confirm('Чтобы удалить папку, выберите ее нажатием мыши в дереве папок и файлов, а затем нажмите "Удалить Папку"');
			return;
		}
		deleteCardsOfFilesOfDeletedFolder(state.currentlyActiveFolderCard);
		await fetch(`http://127.0.0.1:8080/api/entities/folders/${id}`, {method: 'DELETE'});
		await rebuildTree();
		await rebuildMissingFileCardsFromTree();
		rebuildMissingFolderCardsFromTree();
	});
	const dialog = document.getElementById('uploadFileDialog');
	const form = document.getElementById('uploadFileForm');
	if(dialog instanceof HTMLDialogElement && form instanceof HTMLFormElement){
		document.getElementById('cancelButton')!.addEventListener('click', async function(){
			dialog.close('cancel');
		});
		dialog.addEventListener('close', async function(){
			if(dialog.returnValue !== 'ok'){
				return;
			}
			const formData = new FormData(form);
			const providedFile = formData.get('file')!;
			if(!(providedFile instanceof File)){
				confirm('Ожидалось, что кнопка <input type="file" id="fileInput" name="..."/> имеет name="file"');
				return;
			}
			const providedName = providedFile.name;
			const providedParentFolderId = state.currentlyActiveFolderCard.id;
			const parentName = state.currentlyActiveFolderCard.name;
			if(doesFileWithProvidedNameAlreadyExistInCurrentFolderDirectly(providedName)){
				if(!confirm(`В папке ${parentName}, в которую вы выбрали загрузить файл ${providedName}, уже есть одноименный файл, поэтому, если продолжить, новый файл займет место старого.\n\nПродолжить?`)){
					return;
				}
			}
			const response = await fetch('http://127.0.0.1:8080/api/entities/files', {method: 'POST', body: formData});
			if(!response.ok){
				confirm(await response.text());
			}
			await updateState();
		});
	}
	document.getElementById('uploadFile')!.addEventListener('click', function(){
		const parentFolderId = state.currentlyActiveFolderCard.id;
		if(!parentFolderId){
			confirm('Чтобы загрузить файл, выберите нажатием мыши папку, в которую вы хотите его загрузить, а затем нажмите "Загрузить файл"');
			return;
		}
		if(dialog instanceof HTMLDialogElement && form instanceof HTMLFormElement){
			form.reset();
			const input = form.querySelector('#folderIdInput')!;
			if(input instanceof HTMLInputElement){
				input.value = parentFolderId;
			}
			dialog.showModal();
		}
	});
	document.getElementById('downloadFile')!.addEventListener('click', async function(){
		const id = state.currentlyActiveFileCard.id;
		if(!id){
			confirm('Чтобы скачать файл, выберите его нажатием мыши в дереве папок и файлов, а затем нажмите "Скачать файл"');
			return;
		}
		const dummyLink = document.createElement('a');
		dummyLink.download = '';
		document.body.appendChild(dummyLink);
		dummyLink.href = `http://127.0.0.1:8080/api/entities/files/${id}`;
		dummyLink.click();
		dummyLink.remove();
	});
	document.getElementById('deleteFile')!.addEventListener('click', async function(){
		const id = state.currentlyActiveFileCard.id;
		if(!id){
			confirm('Чтобы удалить файл, выберите его нажатием мыши в дереве папок и файлов, а затем нажмите "Удалить файл"');
			return;
		}
		deleteCardOfDeletedFile(state.currentlyActiveFileCard);
		const response = await fetch(`http://127.0.0.1:8080/api/entities/files/${id}`, {method: 'DELETE'});
		if(!response.ok){
			confirm(await response.text());
		}
		await rebuildTree();
	});
	document.getElementById('rename')!.addEventListener('click', async function(){
		const isItFolderThatIsRenamed = state.isLastActivatedEntityOfTypeFolder;
		const currentlyActiveCard = isItFolderThatIsRenamed ? state.currentlyActiveFolderCard : state.currentlyActiveFileCard;
		const id = currentlyActiveCard.id;
		const oldName = currentlyActiveCard.name;
		if(!oldName){
			confirm('Чтобы переименовать, выберите нажатием мыши нужную папку или файл в дереве папок и файлов, а затем нажмите "Переименовать"');
			return;
		}
		const newName = prompt(`Введите новое название ${isItFolderThatIsRenamed ? 'выбранной вами папки' : 'выбранного вами файла'} ${oldName}:`, oldName);
		if(newName === null){
			return;
		}
		if(newName.trim() === ''){
			confirm(`Было введено пустое название, это не разрешено, поэтому ${isItFolderThatIsRenamed ? 'папка не была переименована' : 'файл не был переименован'}`);
			return;
		}
		const result = await (await fetch(`http://127.0.0.1:8080/api/entities/${isItFolderThatIsRenamed ? 'folders' : 'files'}/${id}?name=${newName}`, {method: 'PATCH'})).json();
		if(result.error){
			confirm(result.error);
			return;
		}
		if(!isItFolderThatIsRenamed){
			deleteCardOfDeletedFile(currentlyActiveCard);
		}
		await rebuildTree();
		await rebuildMissingFileCardsFromTree();
	});
});

async function updateState(){
	deleteAllCards();
	await rebuildTree();
	await rebuildMissingFileCardsFromTree();
	rebuildMissingFolderCardsFromTree();
}
function resetState(){
	state.currentlyActiveFileCard = dummyCard; //initializing with a dummy card to simplify state.currentlyActiveFileCard's typescript type
	state.currentlyActiveFolderCard = dummyCard; //initializing with a dummy card to simplify state.currentlyActiveFolderCard's typescript type
	state.isLastActivatedEntityOfTypeFolder = true;
}
async function rebuildTree(){
	resetState();
	const entities = new Set<Entity>(await (await fetch('http://127.0.0.1:8080/api/entities')).json());
	const ul = document.getElementById('file-tree')!;
	let lastChild = ul.lastChild;
	while(lastChild){
		ul.removeChild(lastChild);
		lastChild = ul.lastChild;
	}
	appendChildren(ul, entities, null, 'folder');
	removeArrowsFromEmptyFolders();
}
async function rebuildMissingFileCardsFromTree(){
	const files = document.getElementById('file-tree')!.getElementsByClassName('file');
	for(const f of files){
		if(f instanceof HTMLElement){
			const entityType = f.dataset.type;
			const key = entityType+'-'+f.dataset.id;
			if(!state.cards.has(key)){
				const description = (await (await fetch(`http://127.0.0.1:8080/api/entities/files/descriptions/${f.dataset.id}`)).json()).description;
				const content = (await (await fetch(`http://127.0.0.1:8080/api/entities/files/contents/${f.dataset.id}`)).json()).content;
				const card = new Card(entityType, f.dataset.id!, f.dataset.name!, f.dataset.parentFolderId!, description, content);
				state.cards.set(key, card);
				card.makeContentTopmost();
			}
		}
	}
}
function rebuildMissingFolderCardsFromTree(){
	const folders = document.getElementById('file-tree')!.getElementsByClassName('folder');
	for(const f of folders){
		if(f instanceof HTMLElement){
			const entityType = f.dataset.type;
			const key = entityType+'-'+f.dataset.id;
			if(!state.cards.has(key)){
				state.cards.set(key, new Card(entityType, f.dataset.id!, f.dataset.name!, f.dataset.parentFolderId!, ''));
			}
		}
	}
}
function appendChildren(parentUl: HTMLElement, entities: Set<Entity>, parentId: number | null, parentType: 'folder' | 'file'){
	for(const entity of entities){
		if(entity.parentFolderId === parentId && parentType === 'folder'){
			const div = makeDomElementFromGivenRow(entity);
			parentUl.appendChild(renderLi(div));
			entities.delete(entity);
			const ul = document.createElement('ul');
			div.appendChild(ul);
			appendChildren(ul, entities, entity.id, entity.type); //this recursion stops on its own because looping over an empty collection is a no-op
		}
	}
}
function makeDomElementFromGivenRow(entity: Entity) {
	const div = renderDiv(entity);
	for(const key of Object.keys(entity) as (keyof Entity)[]){
		let value = entity[key];
		if(value === null){
			value = '';
		}
		div.dataset[key] = String(value);
	}
	return div;
}
function renderLi(nodeToAppendAsChild: HTMLElement){
	const li = document.createElement('li');
	li.appendChild(nodeToAppendAsChild);
	return li;
}
function renderDiv(entity: Entity){
	const div = document.createElement('div');
	div.classList.add('tree-node');
	const file = document.createElement('span');
	file.dataset.id = String(entity.id);
	file.dataset.type = String(entity.type);
	file.dataset.name = String(entity.name);
	file.dataset.parentFolderId = String(entity.parentFolderId || '');
	if(entity.type === 'file'){
		file.classList.add('file');
		makeItPossibleToShowDescriptionWhenHoveringOverFile(file);
	}else{
		file.classList.add('folder');
		file.appendChild(renderSpan('arrow','▼'));
		const collapsedArrow = renderSpan('arrow','►');
		collapsedArrow.hidden = true;
		file.appendChild(collapsedArrow);
	}
	addClickHandlerToFileTreeItem(file);
	file.appendChild(renderSpan('icon',entity.fileTypeIcon));
	file.appendChild(renderSpan('name',entity.name));
	div.appendChild(file);
	return div;
}
function renderSpan(_class: string, txt: string){
	const span = document.createElement('span');
	span.classList.add(_class);
	span.appendChild(document.createTextNode(txt));
	return span;
}
function removeArrowsFromEmptyFolders(){
	const treeNodes = Array.from(document.getElementById('file-tree')!.getElementsByClassName('tree-node'));
	for(const treeNode of treeNodes){
		const parent = treeNode.firstElementChild!;
		if(parent instanceof HTMLElement && parent.dataset.type === 'folder' && parent.nextElementSibling!.children.length === 0){
			//removing both the expanded arrow and the collapsed one, whether they are hidden or not
			const arrows = Array.from(parent.children); //converting to array, because otherwise it would be a live collection, where removal would remove unintended elements
			parent.removeChild(arrows[0]!);
			parent.removeChild(arrows[1]!);
		}
	}
}
function addClickHandlerToFileTreeItem(file: HTMLElement){
	file.addEventListener('click', async function(event: Event){
		ensureNoMoreThanOneOpenFolderIcon(file);
		state.currentlyActiveFileCard.deactivate();
		const card = state.cards.get(file.dataset.type+'-'+file.dataset.id)!;
		if(file.dataset.type === 'file'){
			if(card.isHidden()){
				card.show();
			}else{
				card.activate();
			}
			state.currentlyActiveFolderCard = dummyCard;
			state.isLastActivatedEntityOfTypeFolder = false;
		}else{
			const arrows = file.getElementsByClassName('arrow');
			for(const arrow of arrows){
				if(arrow instanceof HTMLElement){
					arrow.hidden = !arrow.hidden;
				}
			}
			toggleVisibilityOfChildrenOfGivenFileTreeItem(file);
			state.currentlyActiveFolderCard = card;
			state.currentlyActiveFileCard = dummyCard;
			state.isLastActivatedEntityOfTypeFolder = true;
		}
	});
}
function toggleVisibilityOfChildrenOfGivenFileTreeItem(item: HTMLElement){
	const ul = item.nextElementSibling!;
	if(ul instanceof HTMLElement){
		ul.hidden = !ul.hidden;
	}
}
function ensureNoMoreThanOneOpenFolderIcon(file: HTMLElement){
	const iconElement = file.getElementsByClassName('icon')[0]!;
	if(iconElement.textContent === '📁'){
		for(const el of document.getElementsByClassName('icon')){
			if(el.textContent === '📂'){
				el.textContent = '📁';
			}
		}
		iconElement.textContent = '📂';
	}
}
function makeItPossibleToShowDescriptionWhenHoveringOverFile(file: HTMLElement){
	const tooltip = document.createElement('span');
	tooltip.classList.add('tooltip');
	file.appendChild(tooltip);
	file.addEventListener('mouseenter', async function(event: MouseEvent){
		clearTimeout(activeTooltipTimer);
		tooltip.textContent = state.cards.get(file.dataset.type+'-'+file.dataset.id)!.description;
		tooltip.style.left = `${event.clientX}px`;
		tooltip.style.top = `${event.clientY}px`;
		tooltip.style.visibility = 'visible';
		//activeTooltipTimer is declared at the top of this file. Its purpose is to be cleared with clearTimeout if we moved the cursor to another item of filetree. I confirmed that it makes each tooltip's time-to-wait-before-closing more consistent if hovering over multiple tooltips quickly
		activeTooltipTimer = setTimeout(() => {
			tooltip.style.visibility = 'hidden';
		}, 5000);
	});
	file.addEventListener('mouseleave', function(event: MouseEvent){
		tooltip.style.visibility = 'hidden';
		tooltip.textContent = '';
		tooltip.style.left = `${event.clientX}px`;
		tooltip.style.top = `${event.clientY}px`;
	});
}
function deleteCardsOfFilesOfDeletedFolder(cardOfDeletedFolder: Card){
	for(const card of state.cards.values()){
		if(card.parentFolderId === cardOfDeletedFolder.id){
			if(card.type === 'folder'){
				deleteCardsOfFilesOfDeletedFolder(card);
				state.cards.delete(card.type+'-'+card.id);
			}else{
				deleteCardOfDeletedFile(card);
			}
		}
	}
}
function deleteCardOfDeletedFile(cardOfDeletedFile: Card){
	state.cards.delete(cardOfDeletedFile.type+'-'+cardOfDeletedFile.id);
	cardOfDeletedFile.tabElement.remove();
	cardOfDeletedFile.contentElement.remove();
}
function deleteAllCards(){
	for(const card of state.cards.values()){
		deleteCardOfDeletedFile(card);
	}
}
function doesFileWithProvidedNameAlreadyExistInCurrentFolderDirectly(providedName: string){
	const directNodesOfCurrentNode = Array.from(getTreeNodeOfCurrentFolder()!.firstElementChild!.nextElementSibling!.children);
	const directFilesOfCurrentFolder = directNodesOfCurrentNode.map(el=>el.firstElementChild!.firstElementChild).filter(el=>el!.classList.contains('file'));
	const namesOfDirectFilesOfCurrentFolder = directFilesOfCurrentFolder.map(el=>el!.lastElementChild!.textContent);
	for(const name of namesOfDirectFilesOfCurrentFolder){
		if(name === providedName){
			return true;
		}
	}
	return false;
}
function getTreeNodeOfCurrentFolder(){
	const treeNodes = Array.from(document.getElementById('file-tree')!.getElementsByClassName('tree-node'));
	for(const treeNode of treeNodes){
		if(treeNode instanceof HTMLElement){
			if(treeNode.firstElementChild!.classList.contains('folder')){
				if(treeNode.dataset.id === state.currentlyActiveFolderCard.id){
					return treeNode;
				}
			}
		}
	}
}