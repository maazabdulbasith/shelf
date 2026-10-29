# Product

Shelf finds a screenshot from a phrase you remember. The person is someone who already takes screenshots instead of notes: a menu, an address, an error, a chat line, a ticket.

## What version one is

A local web app and a folder watcher. Search as you type. A highlight on the matching line. One action on the card, checked against a fixed list, and it runs only after a click. Ask mode cites the screenshots it used and refuses when the evidence is thin or a screenshot tries to give the model instructions.

## What would have to be true before charging

- You miss the wall on a second device often enough to pay for sync.
- The sync design in `docs/sync-design.md` is implemented with the content key on the devices, not on the server.
- A shared team shelf has a real buyer, such as a support or design group that already passes screenshots around in chat.
- The golden-set gate is green on the build you would ship.

## What stays free

The local wall. Search of screenshots that never leave the laptop is the default, and it is the thing the product is for. A subscription that uploads plaintext to someone else's model throws away the reason to use Shelf.

Version one does not create an account, a price, or a cloud resource that bills you.
