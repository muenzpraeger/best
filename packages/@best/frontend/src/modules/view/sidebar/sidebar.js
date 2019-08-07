import { LightningElement, track, wire } from 'lwc';

import { connectRedux, store } from 'store/store';
import { selectProject } from 'store/actions';

export default class ViewSidebar extends LightningElement {
    @track projects = [];
    @track selectedId;

    hasSelectedInitialProject = false;

    @wire(connectRedux, {
        store,
        mapState: ({ projects: { items, selectedProjectId } }) => ({ items, selectedProjectId })
    })
    storeChange({ items, selectedProjectId }) {
        this.selectedId = selectedProjectId;

        this.projects = items.map(item => ({
            ...item,
            classes: item.id === selectedProjectId ? 'item selected' : 'item'
        }));
    }

    renderedCallback() {
        if (!this.hasSelectedInitialProject && this.projects.length) {
            this.hasSelectedInitialProject = true;
            if (this.selectedId) { // from URL
                const project = this.projects.find(proj => proj.id === this.selectedId);
                store.dispatch(selectProject(project));
            } else {
                const firstProject = this.projects[0];
                store.dispatch(selectProject(firstProject));
            }
        }
    }

    selectProject(event) {
        const projectId = parseInt(event.target.dataset.id, 10);
        const project = this.projects.find(proj => proj.id === projectId);
        if (project) {
            store.dispatch(selectProject(project));
        }
    }
}