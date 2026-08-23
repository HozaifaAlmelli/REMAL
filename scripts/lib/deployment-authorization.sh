#!/usr/bin/env bash

validate_deployment_authorization() {
  local actor="${DEPLOY_ACTOR:-}"
  local deployment_id="${DEPLOY_RUN_ID:-}"
  local branch="${DEPLOY_BRANCH:-}"
  local workflow_run="${DEPLOY_WORKFLOW_RUN:-}"
  local authorization_ref="${DEPLOY_AUTHORIZATION_REF:-}"
  local run_id

  [ -n "$actor" ] && [ -n "$deployment_id" ] && [ -n "$workflow_run" ] && [ -n "$authorization_ref" ] || {
    echo "FATAL: deployment actor, id, workflow and authorization reference are required" >&2
    return 1
  }
  [ "$branch" = "main" ] || {
    echo "FATAL: production operations are authorized only from main" >&2
    return 1
  }

  if [[ "$deployment_id" =~ ^gh-([0-9]+)-([0-9]+)$ ]]; then
    run_id="${BASH_REMATCH[1]}"
    [ "$workflow_run" = "https://github.com/HozaifaAlmelli/REMAL/actions/runs/$run_id" ] || {
      echo "FATAL: GitHub workflow URL does not match deployment id" >&2
      return 1
    }
    [ "$authorization_ref" = "github-environment:production:$run_id" ] || {
      echo "FATAL: GitHub production Environment authorization is missing" >&2
      return 1
    }
    return 0
  fi

  if [[ "$deployment_id" =~ ^manual-[A-Za-z0-9._-]+$ ]]; then
    [ "$actor" != "manual" ] && [ "$workflow_run" = "manual" ] || {
      echo "FATAL: emergency manual operation requires an identified actor" >&2
      return 1
    }
    [[ "$authorization_ref" =~ ^emergency:[A-Za-z0-9._-]{3,100}$ ]] || {
      echo "FATAL: emergency manual operation requires a reviewed authorization reference" >&2
      return 1
    }
    return 0
  fi

  echo "FATAL: unsupported production operation identity" >&2
  return 1
}
