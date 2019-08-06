import { register, ValueChangedEvent } from '@lwc/wire-service';
import { diff } from 'deep-object-diff';

export function connectStore(store) {
    return store.getState();
}

register(connectStore, eventTarget => {
    let store;
    let subscription;

    const notifyStateChange = () => {
        const state = store.getState();
        eventTarget.dispatchEvent(new ValueChangedEvent(state));
    };

    eventTarget.addEventListener('connect', () => {
        subscription = store.subscribe(notifyStateChange);
        notifyStateChange();
    });

    eventTarget.addEventListener('disconnect', () => {
        if (subscription) {
            subscription();
        }
    });

    eventTarget.addEventListener('config', config => {
        store = config.store;
    });
});

export function connectRedux(store) {
    return store.getState();
}

function createStateChangedFunction() {
    let previous;
    return (store, config, eventTarget) => {
        const { mapState = (state) => state } = config;
        const state = store.getState();
        const mapped = mapState(state);

        if (previous) {
            const changes = Object.keys(mapped).some(key => {
                let changed = previous[key] !== mapped[key];

                if (changed) {
                    // quick non-identity-based empty array equality check
                    if (previous[key] instanceof Array && mapped[key] instanceof Array
                        && previous[key].length === 0 && mapped[key].length === 0) {
                        changed = false;
                    }

                    // quick non-identity-based empty object equality check
                    if (previous[key] instanceof Object && mapped[key] instanceof Object
                        && Object.keys(previous[key]).length === 0 && Object.keys(mapped[key]).length === 0) {
                        changed = false;
                    }
                }
                
                // temporary check that allows us to see when we are sending new state only bc of identity
                // TODO: eventually kill this
                if (changed) {
                    const diffed = diff(previous, mapped);
                    if (!Object.keys(diffed).length) {
                        console.warn(`identity is only change on '${key}'`, previous[key], mapped[key]);
                    }
                }

                return changed;
            });

            if (!changes) return;
        }

        previous = mapped;
        eventTarget.dispatchEvent(new ValueChangedEvent(mapped));
    }
}

register(connectRedux, eventTarget => {
    let store;
    let subscription;

    eventTarget.addEventListener('config', config => {
        if (subscription) {
            subscription();
            subscription = null;
        }

        store = config.store;

        const notify = createStateChangedFunction();
        notify(store, config, eventTarget);

        subscription = store.subscribe(() => notify(store, config, eventTarget));
    })
})