var syncProvider: any = null;

function setSyncProvider(provider: any): void {
    syncProvider = provider;
}

function createLocalStorageProvider(): any {
    return {
        save: function (data: any): Promise<any> {
            try {
                localStorage.setItem('flux_sync_backup', JSON.stringify(data));
                return Promise.resolve(true);
            } catch (e) {
                return Promise.reject(e);
            }
        },
        load: function (): Promise<any> {
            try {
                var raw = localStorage.getItem('flux_sync_backup');
                return Promise.resolve(raw ? JSON.parse(raw) : null);
            } catch (e) {
                return Promise.reject(e);
            }
        }
    };
}

export {
    setSyncProvider,
    createLocalStorageProvider
};
