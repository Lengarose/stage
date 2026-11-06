import {useState} from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import {X} from 'lucide-react';
import {evidenceLink,restoreEvidenceFocus} from '@/lib/adminDisputeEvidence';

export default function DisputeProofDialog({proof,onClose}) {
  const [failed,setFailed]=useState(false),[loaded,setLoaded]=useState(false);
  const url=evidenceLink(proof.url);
  return <Dialog.Root open onOpenChange={open=>{if(!open)onClose();}}><Dialog.Portal>
    <Dialog.Overlay className="fixed inset-0 z-[120] bg-black/75" />
    <Dialog.Content onCloseAutoFocus={event=>restoreEvidenceFocus(event,proof.opener)} className="fixed left-1/2 top-1/2 z-[121] flex max-h-[94dvh] w-[calc(100vw-2rem)] max-w-4xl -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden border border-border bg-card text-foreground shadow-2xl">
      <header className="flex shrink-0 items-start justify-between gap-4 border-b border-border p-4"><div className="min-w-0"><Dialog.Title className="break-words font-semibold">{proof.label || 'Result evidence'}</Dialog.Title><Dialog.Description className="mt-1 text-sm text-muted-foreground">Stored screenshot supplied for result review. This preview does not approve a result.</Dialog.Description></div><Dialog.Close type="button" aria-label="Close evidence preview" className="flex h-11 w-11 shrink-0 items-center justify-center focus-visible:ring-2 focus-visible:ring-primary"><X size={20}/></Dialog.Close></header>
      <div className="min-h-0 flex-1 overflow-auto bg-background/60 p-4">
        {!url?<p role="alert">The stored attachment link is unavailable.</p>:failed?<p role="alert">The screenshot preview could not be loaded. Open the original attachment below to check whether it is accessible.</p>:<>
          {!loaded && <p role="status" className="mb-3 text-sm">Loading screenshot…</p>}
          <img src={url} alt={proof.label || 'Submitted result evidence'} onLoad={()=>setLoaded(true)} onError={()=>setFailed(true)} className="mx-auto max-h-[70dvh] max-w-full object-contain"/>
        </>}
      </div>
      <footer className="flex shrink-0 flex-wrap items-center gap-5 border-t border-border px-4 py-2 text-sm">
        {url && <><a href={url} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center font-semibold">Open original attachment →</a><a href={url} download className="inline-flex min-h-11 items-center font-semibold">Download</a></>}
        <Dialog.Close type="button" className="min-h-11 font-semibold">Close preview</Dialog.Close>
      </footer>
    </Dialog.Content>
  </Dialog.Portal></Dialog.Root>;
}
