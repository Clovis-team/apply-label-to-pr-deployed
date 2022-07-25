
# Apply label to all PR deployed

This actions is gonna gather all opened PR's, check if they have an active deployment and if so, apply the label.

```
- name: Apply label to all PR deployed
  uses: Clovis-team/apply-label-to-pr-deployed@v1.0.0
  with:
    github_token: ${{ secrets.GITHUB_TOKEN }}
    repo_name: 'REPO_NAME'
    repo_owner: 'REPO_OWNER'
    label_id: 'YOUR_LABEL_ID'
    excluding_label: 'protected'
```

## How to do a new release:

Change the code, then:
```
npm run all
git add -A; git commit -m ""; git push
```

On github, draft a new release
