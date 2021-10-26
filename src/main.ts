import * as core from '@actions/core'
import * as github from '@actions/github'
import type {GraphQlQueryResponseData} from '@octokit/graphql'

type PullRequest = {
  id: string
  number: number
  isDraft: boolean
}

type Deployment = {
  environment: string
  latestStatus: {
    state: string
  }
}

const getAllOpenedPrIds = `query($repo: String!, $owner: String!) {
  repository(name: $repo, owner: $owner) {
    pullRequests(first: 100, states: OPEN) {
      nodes {
        id
        number
        isDraft
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

const addLabelToPR = `mutation AddLabelToPR($pullRequestId: String!, $labelId: String!) {
  addLabelsToLabelable(input: {clientMutationId: "apply-label-to-pr-deployed-action", labelableId: $pullRequestId, labelIds: [$labelId]}) {
    clientMutationId
  }
}`

async function run(): Promise<void> {
  try {
    const token = (core.getInput('github_token') ||
      process.env.GITHUB_TOKEN) as string
    const labelId = core.getInput('label_id')
    const repoName = core.getInput('repo_name')
    const repoOwner = core.getInput('repo_owner')
    const octokit = github.getOctokit(token)

    const allOpenedPrs: GraphQlQueryResponseData = await octokit.graphql(
      getAllOpenedPrIds,
      {
        owner: repoOwner,
        repo: repoName
      }
    )

    // Exclude draft PRs
    const prsReadyForReviews: PullRequest[] =
      allOpenedPrs?.repository.pullRequests.nodes.filter(
        (pr: PullRequest) => !pr.isDraft
      )

    const lastDeployments: GraphQlQueryResponseData = await octokit.graphql(
      getLastDeployments,
      {
        owner: repoOwner,
        repo: repoName
      }
    )

    // Exclude :
    // - main environment
    // - IN_PROGRESS or INACTIVE deployment
    const activeDeployments: string[] =
      lastDeployments?.repository.deployments.nodes
        .filter(
          (d: Deployment) =>
            d.environment !== 'main' && d.latestStatus.state === 'SUCCESS'
        )
        .map((d: Deployment) => d.environment)

    for (const pr of prsReadyForReviews) {
      // Check that the PR has an active deployment (matching deployment url)
      const hasAnActiveDeployment = activeDeployments.filter(
        (environment: string) => environment.includes(`pr-${pr.number}-`)
      ).length
        ? true
        : false

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
