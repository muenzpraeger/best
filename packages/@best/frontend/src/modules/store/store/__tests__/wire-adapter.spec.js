import { createStateChangedNotifier } from '../wire-adapter';

class MockStore {
    _data = {};

    constructor(initialData) {
        this._data = initialData;
    }

    reset() {
        this._data = {};
    }

    setState(state) {
        this._data = state;
    }

    getState() {
        return this._data;
    }
}

describe('createStateChangedNotifier', () => {
    describe('with empty mapper', () => {
        let notify;

        beforeEach(() => {
            notify = createStateChangedNotifier();
        })

        it('dispatches an initial event the first time its called', () => {
            const mockDispatch = jest.fn();
            const mockEventTarget = {
                dispatchEvent: mockDispatch
            }

            const initialState = { name: 'Property 1' };
            const store = new MockStore(initialState);
            notify(store, {}, mockEventTarget);

            expect(mockDispatch).toHaveBeenCalledTimes(1);
            expect(mockDispatch.mock.calls[0][0]).toEqual({ type: 'ValueChangedEvent', value: initialState });
        })

        it('dispatches an event when the store changes', () => {
            const mockDispatch = jest.fn();
            const mockEventTarget = {
                dispatchEvent: mockDispatch
            }

            const initialState = { name: 'Property 1' };
            const store = new MockStore(initialState);
            notify(store, {}, mockEventTarget);

            const secondState = { job: 'Property 2' };
            store.setState(secondState);
            notify(store, {}, mockEventTarget);

            expect(mockDispatch).toHaveBeenCalledTimes(2);
            expect(mockDispatch.mock.calls[1][0]).toEqual({ type: 'ValueChangedEvent', value: secondState });
        })

        it('does NOT dispatch when the store does NOT change', () => {
            const mockDispatch = jest.fn();
            const mockEventTarget = {
                dispatchEvent: mockDispatch
            }

            const initialState = { name: 'Property 1' };
            const store = new MockStore(initialState);
            notify(store, {}, mockEventTarget);
            notify(store, {}, mockEventTarget);

            expect(mockDispatch).toHaveBeenCalledTimes(1);
        })
    })
})