import { PreviewView } from './views/PreviewView.js';
import { SphereViewer } from './widgets/SphereViewer.js';
import { toast } from './components/Toast.js';

const app = document.getElementById('app')!;
const viewer = new SphereViewer(window.innerWidth - 260, window.innerHeight);
const view = new PreviewView(viewer);
app.append(view.root);
void view.list.load().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  toast.error('Material database unavailable', message, 0);
});
