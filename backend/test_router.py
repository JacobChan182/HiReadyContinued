import argparse

from services.chat_router import (
    get_allowed_llms,
    get_routing_config,
    route_llm_for_message,
    validate_llm_choice,
)


def main() -> None:
    parser = argparse.ArgumentParser(description="Quick router sanity checks")
    parser.add_argument("--message", required=True, help="User message to route")
    args = parser.parse_args()

    allowed = get_allowed_llms()
    config = get_routing_config()

    provider, model, reason = route_llm_for_message(args.message)
    provider, model, fallback = validate_llm_choice(
        provider,
        model,
        allowed=allowed,
        fallback_provider=config["DEFAULT_PROVIDER"],
        fallback_model=config["DEFAULT_MODEL"],
    )

    if fallback:
        reason = f"{reason};{fallback}"

    print(f"provider={provider}")
    print(f"model={model}")
    print(f"reason={reason}")


if __name__ == "__main__":
    main()
