import OfferContractDialog from './OfferContractDialog';
export default function RenewContractDialog({open,onClose,contract,player,club,onProposalCreated}) {
 return <OfferContractDialog open={open} onClose={onClose} player={player} club={club||{id:contract?.team_id}} existingContract={contract} purpose="renewal" onProposalCreated={onProposalCreated}/>;
}
