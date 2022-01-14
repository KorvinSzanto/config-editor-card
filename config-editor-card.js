console.info("Config Editor 1.0 - monaco");
const LitElement = window.LitElement || Object.getPrototypeOf(customElements.get("hui-masonry-view"));
const html = LitElement.prototype.html;

class ConfigEditorMonaco extends LitElement {

    static get properties() {
        return {
            _hass: { type: Object },
            editor: { type: Object },
            code: { type: String },
            fileList: { type: Array },
            openedFile: { type: String },
            infoLine: { type: String },
            alertLine: { type: String },
        };
    }

    constructor() {
        super();
        this.code = '';
        this.editor = null;
        this.fileList = [];
        this.openedFile = '';
        this.infoLine = '';
        this.alertLine = '';
    }

    render() {
        if (!this._hass.states['config_editor.version']) { return html`<ha-card>Missing 'config_editor:' in configuration.yaml for github.com/htmltiger/config-editor</ha-card>`; }
        if (this.fileList.length < 1) {
            this.openedFile = localStorage.getItem('config_editorOpen');
            if (!this.openedFile) {
                this.openedFile = '';
            }
            this.List();
        }

        return html`
            <ha-card>
                <div style="min-height: calc(100vh - var(--header-height));">
                    <div id="code-container" mode="yaml" @load="this.createEditor" style='height:calc(100vh - var(--header-height) - 50px)'></div>
                </div>
                
                <div style="height:50px; position: -webkit-sticky; position: sticky; bottom: 0; z-index:2; background: var(--app-header-background-color); color: var(--app-header-text-color, white)">
                    <div>${this.alertLine}</div>
                    <div>        
                    <button @click="${this.List}">Get List</button>
                    <select @change=${this.Load}>
                    ${[''].concat(this.fileList).map(value => html`<option ?selected=${value === this.openedFile} value=${value}>${value}</option>`)}
                    </select>
                    <button @click="${this.Save}">Save</button>
                    </div>
                    <code>#${this.infoLine}</code>
                </div>
            </ha-card>
        `;
    }

    async createEditor(promise) {
        if (typeof require === 'undefined') {
            // Wait for require to be ready
            const scr = document.createElement('script')
            scr.src='https://unpkg.com/monaco-editor@0.31.0/min/vs/loader.js'
            document.head.append(scr)
            
            while (typeof require === 'undefined') {
                // Wait 100ms and check again
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        }

        require.config({ paths: { 'vs': 'https://unpkg.com/monaco-editor@0.31.0/min/vs' }});
        window.MonacoEnvironment = {
            getWorkerUrl: function(workerId, label) {
            return `data:text/javascript;charset=utf-8,${encodeURIComponent(`
                    self.MonacoEnvironment = {
                        baseUrl: 'https://unpkg.com/monaco-editor@latest/min/'
                    };
                    importScripts('https://unpkg.com/monaco-editor@latest/min/vs/base/worker/workerMain.js');`
                )}`;
            }
        };

        const me = this
        require(["vs/editor/editor.main"], function () {
            me.editor = monaco.editor.create(me.renderRoot.getElementById('code-container'), {
                value: me.code ? me.code : '',
                language: 'yaml',
                theme: 'vs-dark',
            });
        });
    }

    updateText(e) {
        this.code = e.detail.value;
        if (this.openedFile) { localStorage.setItem('config_editorText', this.code); }
    }

    Unsave() {
        this.code = localStorage.getItem('config_editorUnsaved');
        if (this.editor) {
            this.editor.setValue(this.code);
        }
        localStorage.removeItem('config_editorUnsaved');
        this.alertLine = '';
    }

    async oldText(dhis) {
        dhis.Load({ target: { value: dhis.openedFile } });
    }

    async Coder() {
        if (customElements.get("developer-tools-event")) { return; }
        await customElements.whenDefined("partial-panel-resolver");
        const p = document.createElement('partial-panel-resolver');
        p.hass = { panels: [{ url_path: "tmp", component_name: "developer-tools" }] };
        p._updateRoutes();
        await p.routerOptions.routes.tmp.load()
        await customElements.whenDefined("developer-tools-router");
        const d = document.createElement("developer-tools-router");
        await d.routerOptions.routes.event.load();
    }
    async List() {
        this.infoLine = 'List Loading...';
        const e = (await this._hass.callWS({ type: "config_editor/ws", action: 'list', data: '', file: '' }));
        this.fileList = e.file.slice().sort();
        this.infoLine = e.msg;
        if (this.openedFile) {
            setTimeout(this.oldText, 500, this);
        }
    }
    async Load(x) {
        this.code = ''; 
        if (this.editor) {
            this.editor.setValue(this.code);
        }
        this.infoLine = '';
        this.openedFile = x.target.value
        if (this.openedFile) {
            this.infoLine = 'Loading: ' + this.openedFile;
            const e = (await this._hass.callWS({ type: "config_editor/ws", action: 'load', data: '', file: this.openedFile }));
            this.openedFile = e.file;
            this.infoLine = e.msg;
            const uns = { f: localStorage.getItem('config_editorOpen'), d: localStorage.getItem('config_editorText') };
            if (uns.f == this.openedFile && uns.d && uns.d != e.data) {
                localStorage.setItem('config_editorUnsaved', uns.d);
                this.alertLine = html`<i style="background:#ff7a81;cursor:pointer" @click="${this.Unsave}"> Load unsaved from browser </i>`;
            } else {
                localStorage.removeItem('config_editorText'); this.alertLine = '';
            }
            this.code = e.data;
            if (this.editor) {
                this.editor.setValue(this.code);
            }
        }
        localStorage.setItem('config_editorOpen', this.openedFile);
    }
    async Save() {
        if (this.editor.value != this.code) {
            this.infoLine = 'Something not right!';
            return;
        }
        if (!this.openedFile && this.code) {
            this.openedFile = prompt("type abc.yaml or folder/abc.yaml");
        }
        if (this.openedFile && this.openedFile.endsWith(".yaml")) {
            if (!this.code) { this.infoLine = ''; this.infoLine = 'Text is empty!'; return; }
            this.infoLine = 'Saving: ' + this.openedFile;
            const e = (await this._hass.callWS({ type: "config_editor/ws", action: 'save', data: this.code, file: this.openedFile }));
            this.infoLine = e.msg;
            localStorage.removeItem('config_editorText');
        } else { this.openedFile = ''; }

    }

    getCardSize() {
        return 5;
    }

    setConfig(config) {
        this.Coder();
    }

    set hass(hass) {
        this._hass = hass;
    }

    shouldUpdate(changedProps) {
        if (changedProps.has('code') || changedProps.has('openedFile') || changedProps.has('fileList') || changedProps.has('alertLine') || changedProps.has('infoLine')) { return true; }
    }

    async firstUpdated() {
        await this.createEditor()
    }

}
customElements.define('config-editor-card-monaco', ConfigEditorMonaco);

window.customCards = window.customCards || [];
window.customCards.push({
    type: 'config-editor-card',
    name: 'Config Editor Card',
    preview: false,
    description: 'Basic editor for configuration.yaml'
});
