import { toJS } from "mobx";

/**
* Simple object check.
* @param item
* @returns {boolean}
*/
export function isObject (item) {
    return (item && typeof item === 'object' && !Array.isArray(item) && !(item instanceof Map));
}

export function isArray (item) {
    return Array.isArray(item)
}

export function isMap (item) {
    return (item && typeof item === 'object' && item instanceof Map)
}


// https://stackoverflow.com/a/34749873
/**
* Deep merge two objects.
* @param target
* @param ...sources
*/
export function mergeDeep (target, ...sources) {
    if (!sources.length) return target;
    const source = sources.shift();
    
    if (isObject(target) && isObject(source)) {
        for (const key in source) {
            if (isObject(source[key])) {
                if (!target[key]) Object.assign(target, { [key]: {} });
                mergeDeep(target[key], source[key]);
            }
            else if (isArray(source[key])) {
                if (!target[key]) target[key] = source[key]
                else target[key] = [ ...target[key], ...source[key] ]
            }
            else if (isMap(source[key])) {
                if (!target[key]) target[key] = new Map()
                mergeDeep(toJS(target[key]), toJS(source[key]))
            }
            else {
                Object.assign(target, { [key]: source[key] });
            }
        }
    }

    else if (isMap(target) && isMap(source)) {
        console.log('both are maps')
        for (let key of source.keys()) {
            if (isObject(source.get(key))) {
                if (!target.get(key)) target.set(key, {});
                mergeDeep(target.get(key), source.get(key));
            }
            else if (isArray(source.get(key))) {
                if (!target.get(key)) target.set(key, source.get(key))
                else target.set(key, [ ...target.get(key), ...source.get(key) ])
            }
            else if (isMap(source.get(key))) {
                if (!target.get(key)) target.set(key, source.get(key))
                mergeDeep(target.get(key), source.get(key))
            }
            else {
                target.set(key, source.get(key))
            }
        }
    }
    
    return mergeDeep(target, ...sources);
}