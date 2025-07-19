// Mock for Obsidian API
export class Plugin {
    app: any;
    manifest: any;
    
    constructor(app: any, manifest: any) {
        this.app = app;
        this.manifest = manifest;
    }
    
    onload() {}
    onunload() {}
    addCommand() {}
    addSettingTab() {}
    loadData() {
        return Promise.resolve({});
    }
    saveData() {
        return Promise.resolve();
    }
}

export class Setting {
    constructor(public containerEl: HTMLElement) {}
    setName() { return this; }
    setDesc() { return this; }
    addText() { return this; }
    addButton() { return this; }
    addToggle() { return this; }
    addDropdown() { return this; }
}

export class PluginSettingTab {
    constructor(public app: any, public plugin: any) {}
    display() {}
}

export class Modal {
    constructor(public app: any) {}
    open() {}
    close() {}
    onOpen() {}
    onClose() {}
}

export class Notice {
    constructor(message: string, timeout?: number) {}
}

export const Platform = {
    isMobile: false,
    isDesktop: true,
    isWin: false,
    isMacOS: true,
    isLinux: false
};

export class Component {
    load() {}
    unload() {}
    addChild() {}
    removeChild() {}
}

export class TFile {
    constructor(public path: string) {}
    name: string = '';
    basename: string = '';
    extension: string = '';
}

export class Vault {
    read() { return Promise.resolve(''); }
    create() { return Promise.resolve(new TFile('')); }
    modify() { return Promise.resolve(); }
    delete() { return Promise.resolve(); }
}

export class App {
    vault = new Vault();
    workspace = {
        getActiveFile: () => null,
        getLeavesOfType: () => [],
        activeLeaf: null
    };
}