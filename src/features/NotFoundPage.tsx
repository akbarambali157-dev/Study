import { Link } from 'react-router-dom'
import { EmptyState } from '@/components/ui/misc'
import { Button } from '@/components/ui/Button'

export function NotFoundPage() {
  return (
    <div className="mx-auto max-w-md pt-10">
      <EmptyState
        title="Nothing at this address"
        body="The link may be old, or the deck may have been deleted."
        action={
          <Link to="/">
            <Button>Back to Today</Button>
          </Link>
        }
      />
    </div>
  )
}
