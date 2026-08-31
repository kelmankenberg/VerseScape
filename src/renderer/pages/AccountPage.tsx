import { PagePlaceholder } from '../components/PagePlaceholder.js';

export function AccountPage(): React.JSX.Element {
  return (
    <PagePlaceholder
      title="Account"
      description="VerseScape works entirely offline and needs no account. Optional sync is a v2 consideration."
      milestone="v2"
    />
  );
}
