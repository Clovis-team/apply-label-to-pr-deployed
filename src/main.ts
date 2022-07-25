import * as core from '@actions/core'
import * as github from '@actions/github'
import type { GraphQlQueryResponseData } from '@octokit/graphql'

type PullRequest = {
  id: string
  number: number
}

type Deployment = {
  environment: string
  latestStatus: {
    state: string
  }
}

const getAllOpenedPrIds = `query($repo: String!, $owner: String!, $excludingLabel: [String!]) {
  repository(name: $repo, owner: $owner) {
    pr_protected: pullRequests(first: 100, states: OPEN, labels: $excludingLabel) {
      nodes {
        id
        number
      }
    }
    pullRequests(first: 100, states: OPEN) {
      nodes {
        id
        number
      }
    }
  }
}`

const getLastDeployments = `query($repo: String!, $owner: String!) {
  repository(name: $repo, owner: $owner) {
    deployments(last: 100) {
      nodes {
        environment
        latestStatus {
          state
        }
      }
    }
  }
}`

const addLabelToPR = `mutation AddLabelToPR($pullRequestId: ID!, $labelId: ID!) {
  addLabelsToLabelable(input: {clientMutationId: "apply-label-to-pr-deployed-action", labelableId: $pullRequestId, labelIds: [$labelId]}) {
    clientMutationId
  }
}`

async function run(): Promise<void> {
  try {
    const token = (core.getInput('github_token') ||
      process.env.GITHUB_TOKEN) as string
    const labelId = core.getInput('label_id')
    const excludingLabel = core.getInput('excluding_label')
    const repoName = core.getInput('repo_name')
    const repoOwner = core.getInput('repo_owner')
    const octokit = github.getOctokit(token)

    const pullRequests: GraphQlQueryResponseData = await octokit.graphql(
      getAllOpenedPrIds,
      {
        owner: repoOwner,
        repo: repoName,
        excludingLabel: excludingLabel ? [excludingLabel] : []
      }
    )

    const lastDeployments: GraphQlQueryResponseData = await octokit.graphql(
      getLastDeployments,
      {
        owner: repoOwner,
        repo: repoName
      }
    )

    const activeDeployments: string[] =
      lastDeployments?.repository.deployments.nodes
        .filter(
          (d: Deployment) =>
            d.latestStatus.state === 'SUCCESS' ||
            d.latestStatus.state === 'IN_PROGRESS'
        )
        .map((d: Deployment) => d.environment)

    const excludedPullRequests =
      pullRequests?.repository.pr_protected.nodes.map(
        (pr: PullRequest) => pr.id
      )
    const filteredPullRequests: PullRequest[] =
      pullRequests.repository.pullRequests.nodes.filter(
        (pr: PullRequest) => !excludedPullRequests.includes(pr.id)
      )

    for (const pr of filteredPullRequests) {
      // Check that the PR has an active deployment (matching deployment url)
      const hasAnActiveDeployment = Boolean(
        activeDeployments.filter((environment: string) =>
          environment.includes(`pr-${pr.number}`)
        ).length
      )

      if (hasAnActiveDeployment) {
        // Apply custom label
        await octokit.graphql(addLabelToPR, {
          pullRequestId: pr.id,
          labelId
        })
      }
    }
  } catch (error) {
    if (error instanceof Error) core.setFailed(error.message)
  }
}

run()
