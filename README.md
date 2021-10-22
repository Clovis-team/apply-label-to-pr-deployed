
# Apply label to all PR deployed

This actions is gonna gather all opened PR's, check if they have an active deployment and if so, apply the label.

```
- name: Pass all the associated open PR's to draft
  uses: Clovis-team/apply-label-to-pr-deployed@v1.0.0
  with:
    github_token: ${{ secrets.GITHUB_TOKEN }}
    label_id: 'YOUR_LABEL_ID'
```

## How to do a new release:

Change the code, then:
```
npm run all
git add -A; git commit -m ""; git push
```

On github, draft a new release