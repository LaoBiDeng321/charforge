/**
 * SiteData - 站点数据加载器
 * 站点已扁平化：不再把全文内联进 data.js，而是 fetch('index.json')。
 * 同一个 index.json 也作为 Agent 可读取的机器可读清单。
 */

(function () {
    'use strict';

    var DATA_URL = 'index.json';
    var promise = null;

    function load() {
        if (promise) return promise;

        promise = fetch(DATA_URL, { cache: 'no-cache' })
            .then(function (res) {
                if (!res.ok) throw new Error('Failed to load ' + DATA_URL + ': ' + res.status);
                return res.json();
            })
            .then(function (data) {
                window.SITE_DATA = data;
                return data;
            })
            .catch(function (err) {
                promise = null;
                throw err;
            });

        return promise;
    }

    window.SiteData = { load: load };
})();
